import Foundation
import Network
import Observation
import TodoCore

/// Drives the TodoCore reducer, persists list changes and expires the undo toast.
@MainActor
@Observable
final class TodoViewModel {
    private(set) var state = TodoState.initial
    var filter: TodoFilter = .all
    var sort: TodoSort {
        didSet { defaults.set(sort.rawValue, forKey: sortStorageKey) }
    }
    var selecting = false
    /// Daybook tab; leaving one forgets which todos were completed there (spec/features/daybook.md).
    var tab: DaybookTab = .today {
        didSet {
            guard tab != oldValue else { return }
            seenOpen = []
            if tab != .today { exitSelectMode() }
        }
    }
    var doneOpen = false
    /// Todos seen open on this view. Completing one keeps it in place (struck through) until the view is left.
    @ObservationIgnored private var seenOpen: Set<String> = []
    var selectedIds: Set<String> = []
    var confirmingDelete = false

    private var store: TodoStore
    private let reminders: ReminderScheduling?
    private let defaults: UserDefaults
    private let now: () -> Date
    private var expiry: Task<Void, Never>?
    /// The last signed-in edit couldn't be pushed and was rolled back.
    private(set) var pushFailed = false
    private var sync: SyncEngine?
    private var syncUserId: String?
    private var realtime: RealtimeConnection?
    /// The live connection while the account list syncs over Realtime; nil for the guest list.
    private(set) var connection: ConnectionState?
    /// The device has a network (`NWPathMonitor`).
    private(set) var online = true
    private let pathMonitor = NWPathMonitor()
    private var pushFailedTimer: Task<Void, Never>?

    init(
        store: TodoStore, reminders: ReminderScheduling? = nil, defaults: UserDefaults = .standard,
        now: @escaping () -> Date = Date.init
    ) {
        self.store = store
        self.reminders = reminders
        self.defaults = defaults
        self.now = now
        sort = parseStoredSort(defaults.string(forKey: sortStorageKey))
        state = reduceTodos(state, .load(store.load()), now: now())
        reminders?.sync(state.todos)
        pathMonitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.setOnline(online) }
        }
        pathMonitor.start(queue: .main)
    }

    /// Getting the network back reconnects now instead of waiting for the backoff (spec/features/realtime.md).
    private func setOnline(_ next: Bool) {
        let regained = next && !online
        online = next
        if regained { resume() }
    }

    /// Switches between the guest list and the signed-in account's local cache.
    func useStore(_ next: TodoStore) {
        store = next
        exitSelectMode()
        state = reduceTodos(TodoState.initial, .load(store.load()), now: now())
        reminders?.sync(state.todos)
    }

    /// Signed in: syncs the shown (account) list with `server` as `userId`, live over `realtime`; nil stops syncing
    /// (spec/features/sync.md, spec/features/realtime.md).
    func useSync(_ server: (any SyncServer)?, userId: String?, realtime transport: (any RealtimeTransport)? = nil) {
        let key = server == nil ? nil : userId
        guard key != syncUserId else { return }
        realtime?.disconnect()
        sync?.close()
        syncUserId = key
        guard let server, let userId = key else {
            sync = nil
            realtime = nil
            connection = nil
            return
        }
        if let transport {
            let live = RealtimeConnection(transport: transport)
            live.onStateChange = { [weak self] in self?.connection = $0 }
            realtime = live
            connection = live.state
        } else {
            realtime = nil
            connection = nil
        }
        let defaults = defaults
        sync = SyncEngine(
            server: server, userId: userId,
            loadCursor: { Int64(defaults.integer(forKey: AuthViewModel.syncCursorKey)) },
            saveCursor: { defaults.set(Int($0), forKey: AuthViewModel.syncCursorKey) },
            current: { [weak self] in self?.state.todos ?? [] },
            replace: { [weak self] in self?.replaceTodos($0) },
            onPushFailed: { [weak self] in self?.showPushFailed() }, now: now)
        resume()
    }

    /// Foreground (`scenePhase` `.active`): reconnects, which pulls, when the list is live; else just pulls.
    func resume() {
        guard let realtime, let sync, let userId = syncUserId else { return pull() }
        realtime.connect(
            RealtimeTarget(
                userId: userId, pull: { try await sync.pull() }, applyRemote: { sync.applyRemote($0) }))
    }

    /// Background (`scenePhase` `.background`): closes the Realtime socket.
    func suspend() {
        realtime?.disconnect()
    }

    /// Pulls the account list's changes since the cursor; no-op while signed out.
    func pull() {
        guard let sync else { return }
        Task { try? await sync.pull() }
    }

    private func replaceTodos(_ todos: [Todo]) {
        state = reduceTodos(state, .load(todos), now: now())
        store.save(state.todos)
        reminders?.sync(state.todos)
    }

    private func showPushFailed() {
        pushFailed = true
        pushFailedTimer?.cancel()
        pushFailedTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            self?.pushFailed = false
        }
    }

    /// Asks for notification permission the first time the user picks a reminder.
    func requestReminderPermission() {
        reminders?.requestAuthorization { [weak self] in
            guard let self else { return }
            self.reminders?.sync(self.state.todos)
        }
    }

    var visibleTodos: [Todo] { sortTodos(filterTodos(state.todos, filter), sort) }
    var remaining: Int { countRemaining(state.todos) }
    var completedCount: Int { countCompleted(state.todos) }
    var selected: [String] { visibleTodos.map(\.id).filter(selectedIds.contains) }
    var allVisibleSelected: Bool { !visibleTodos.isEmpty && selected.count == visibleTodos.count }
    var remainingText: String { t("list.remaining", ["count": remaining]) }
    var undoLabel: String? { state.undoable?.label }
    var stats: TodoStats { computeStats(state.todos, now: now()) }
    var today: String { localDateKey(now()) }
    var progress: DaybookProgress { daybookProgress(state.todos, now: now()) }
    var upcoming: [UpcomingDay] { upcomingDays(sortTodos(state.todos, sort), today: today) }
    var showDone: Bool { doneOpen || filter == .completed }

    /// Visible todos grouped for Today; a todo completed on this view stays in its group.
    var sections: DaybookSections {
        let visible = visibleTodos
        for todo in state.todos where !todo.completed { seenOpen.insert(todo.id) }
        let byId = Dictionary(visible.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let grouped = daybookSections(
            visible.map { todo in
                var copy = todo
                if copy.completed, seenOpen.contains(copy.id) { copy.completed = false }
                return copy
            },
            today: today)
        func real(_ todos: [Todo]) -> [Todo] { todos.compactMap { byId[$0.id] } }
        var result = DaybookSections()
        result.slipped = real(grouped.slipped)
        result.today = real(grouped.today)
        result.later = real(grouped.later)
        result.done = real(grouped.done)
        return result
    }
    var emptyText: String {
        state.todos.isEmpty ? t("list.empty") : t("list.emptyFiltered", ["filter": filter.rawValue])
    }

    func add(_ draft: TodoDraft) {
        dispatch(.prepend(addTodos([], drafts: [draft], now: now()).created))
    }

    func toggle(_ id: String) { dispatch(.toggle(id: id)) }
    func rename(_ id: String, title: String) { dispatch(.rename(id: id, title: title)) }
    func remove(_ id: String) { dispatch(.remove(ids: [id])) }
    func clearCompleted() { dispatch(.clearCompleted) }

    func toggleSelectMode() {
        if selecting { exitSelectMode() } else { selecting = true }
    }

    func toggleSelected(_ id: String) {
        if selectedIds.contains(id) { selectedIds.remove(id) } else { selectedIds.insert(id) }
    }

    func toggleSelectAll() {
        selectedIds = allVisibleSelected ? [] : Set(visibleTodos.map(\.id))
    }

    func toggleSelectedComplete() {
        dispatch(.toggleMany(ids: selected))
        exitSelectMode()
    }

    func deleteSelected() {
        dispatch(.remove(ids: selected))
        exitSelectMode()
    }

    /// The list went read-only (spec/features/realtime.md#connection-status).
    func leaveSelectMode() {
        if selecting { exitSelectMode() }
    }

    func exitSelectMode() {
        selecting = false
        selectedIds = []
        confirmingDelete = false
    }
    func undo() { dispatch(.undo) }
    func addSubtask(_ id: String, title: String) { dispatch(.addSubtask(id: id, title: title)) }
    func toggleSubtask(_ id: String, subtaskId: String) { dispatch(.toggleSubtask(id: id, subtaskId: subtaskId)) }
    func removeSubtask(_ id: String, subtaskId: String) { dispatch(.removeSubtask(id: id, subtaskId: subtaskId)) }

    /// Drops `id` onto `targetId` within the shown rows and switches to manual sort so the new order shows.
    func reorder(_ id: String, onto targetId: String) {
        dispatch(.reorder(visibleIds: visibleTodos.map(\.id), id: id, targetId: targetId))
        sort = .manual
    }

    private func dispatch(_ action: TodoAction) {
        let previous = state
        state = reduceTodos(state, action, now: now())
        if state.todos != previous.todos {
            store.save(state.todos)
            reminders?.sync(state.todos)
            if let sync {
                let before = previous.todos
                let after = state.todos
                Task { await sync.edit(before: before, after: after) }
            }
        }
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

enum DaybookTab: String, CaseIterable {
    case today, upcoming, stats
}
