import Foundation
import Network
import Observation
import TodoCore

/// `enabled` is false when the build has no Supabase config; `pendingEmail` is set once a code was emailed.
struct AuthState: Equatable {
    var enabled = false
    var user: AuthUser?
    var pendingEmail: String?
    var busy = false
    var status: String?
}

/// Drives the TodoCore reducer, persists list changes (SwiftData signed out, the account's rows signed in)
/// and expires the undo toast.
@MainActor
@Observable
final class TodoViewModel {
    private(set) var state = TodoState.initial
    private(set) var hydrated = false
    private(set) var auth = AuthState()
    /// Changes made on this device that haven't reached the account yet.
    private(set) var unsynced = 0
    var filter: TodoFilter = .all

    private let store: TodoStore
    private let account: AccountSession?
    private let now: () -> Date
    private var cloud: OfflineCloudStore?
    private var expiry: Task<Void, Never>?
    private var saving: Task<Void, Never>?
    private var feed: TodoChangeFeed?
    private var syncQueued = false
    private var connectivity: NWPathMonitor?

    init(store: TodoStore, account: AccountSession? = nil, now: @escaping () -> Date = Date.init) {
        self.store = store
        self.account = account
        self.now = now
        auth = AuthState(enabled: account != nil, user: account?.session?.user)
        useStore(for: auth.user)
    }

    var visibleTodos: [Todo] { sortByPriority(filterTodos(state.todos, filter)) }
    var remaining: Int { countRemaining(state.todos) }
    var hasCompleted: Bool { state.todos.count > remaining }
    var remainingText: String { "\(remaining) \(remaining == 1 ? "task" : "tasks") remaining" }
    var undoLabel: String? { state.undoable?.label }
    var emptyText: String {
        state.todos.isEmpty ? "No todos yet. Add your first one above." : "No \(filter.rawValue) todos."
    }

    func add(_ draft: TodoDraft) {
        dispatch(.prepend(addTodos([], drafts: [draft], now: now()).created))
    }

    func toggle(_ id: String) { dispatch(.toggle(id: id)) }
    func rename(_ id: String, title: String) { dispatch(.rename(id: id, title: title)) }
    func remove(_ id: String) { dispatch(.remove(ids: [id])) }
    func clearCompleted() { dispatch(.clearCompleted) }
    func undo() { dispatch(.undo) }

    // MARK: - Account

    func sendCode(email: String) {
        authTask { [weak self] account in
            try await account.client.sendCode(email: email)
            self?.auth.pendingEmail = email
            self?.auth.status = "We emailed a 6-digit code to \(email)."
        }
    }

    func verifyCode(_ code: String) {
        guard let email = auth.pendingEmail else { return }
        authTask { [weak self] account in
            self?.signedIn(account, try await account.client.verifyCode(email: email, code: code))
        }
    }

    func changeEmail() {
        auth.pendingEmail = nil
        auth.status = nil
    }

    func providerURL(_ provider: String) -> URL? { account?.client.authorizeURL(provider: provider) }

    /// OAuth redirect `todotracker://auth#access_token=…`.
    func handleRedirect(_ url: URL) {
        guard url.scheme == "todotracker", url.host == "auth" else { return }
        authTask { [weak self] account in
            self?.signedIn(account, try await account.client.session(fromRedirect: url))
        }
    }

    func signOut() {
        authTask { [weak self] account in
            await account.signOut()
            self?.auth.user = nil
            self?.auth.pendingEmail = nil
            self?.useStore(for: nil)
        }
    }

    private func signedIn(_ account: AccountSession, _ session: AuthSession) {
        account.store(session)
        auth.user = session.user
        auth.pendingEmail = nil
        auth.status = nil
        useStore(for: session.user)
    }

    private func authTask(_ body: @escaping @MainActor (AccountSession) async throws -> Void) {
        guard let account, !auth.busy else { return }
        auth.busy = true
        auth.status = nil
        Task { [weak self] in
            do {
                try await body(account)
            } catch {
                self?.auth.status = error.localizedDescription
            }
            self?.auth.busy = false
        }
    }

    /// Signed in: the account's offline-first cache, synced in the background. Signed out: SwiftData.
    private func useStore(for user: AuthUser?) {
        expiry?.cancel()
        feed?.close()
        feed = nil
        connectivity?.cancel()
        connectivity = nil
        guard let user, let account else {
            cloud = nil
            unsynced = 0
            state = reduceTodos(.initial, .load(store.load()), now: now())
            hydrated = true
            return
        }
        let cloud = OfflineCloudStore(account: account, userId: user.id, signedOut: account.isMigrated(user.id) ? [] : store.load())
        self.cloud = cloud
        state = reduceTodos(.initial, .load(cloud.todos), now: now())
        hydrated = true
        unsynced = cloud.pending
        feed = TodoChangeFeed(account: account, userId: user.id) { [weak self] in self?.requestSync(cloud) }
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor in self?.requestSync(cloud) }
        }
        monitor.start(queue: .main)
        connectivity = monitor
        requestSync(cloud)
    }

    /// Syncs after every save, on changes made on other devices (Supabase Realtime) and when the network comes
    /// back: one sync at a time, queued behind pending ones. A failed sync leaves the changes queued in the cache.
    private func requestSync(_ cloud: OfflineCloudStore) {
        guard self.cloud === cloud, !syncQueued else { return }
        syncQueued = true
        let previous = saving
        saving = Task { [weak self] in
            await previous?.value
            guard let self, self.cloud === cloud else { return }
            syncQueued = false
            let snapshot = state.todos
            defer { if self.cloud === cloud { unsynced = cloud.pending } }
            guard let plan = try? await cloud.pull(local: snapshot), self.cloud === cloud else { return }
            // Edited during the fetch: plan again from the latest list.
            guard state.todos == snapshot else { return requestSync(cloud) }
            if plan.changed {
                state = reduceTodos(state, .load(plan.todos), now: now())
                cloud.save(plan.todos)
            }
            try? await cloud.push(plan)
        }
    }

    private func persist() {
        guard let cloud else {
            store.save(state.todos)
            return
        }
        cloud.save(state.todos)
        unsynced = cloud.pending
        requestSync(cloud)
    }

    private func dispatch(_ action: TodoAction) {
        guard hydrated else { return }
        let previous = state
        state = reduceTodos(state, action, now: now())
        if state.todos != previous.todos { persist() }
        if state.undoable != previous.undoable { scheduleExpiry() }
    }

    private func scheduleExpiry() {
        expiry?.cancel()
        guard let entry = state.undoable else { return }
        let delay = max(0, entry.at + undoTimeoutMs - Timestamp.milliseconds(now()))
        expiry = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(delay))
            guard !Task.isCancelled else { return }
            self?.dispatch(.expireUndo)
        }
    }
}
