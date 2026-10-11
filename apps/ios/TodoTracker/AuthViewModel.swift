import Foundation
import Observation
import TodoCore

/// Which local list the todo screen shows.
enum TodoScope {
    case guest, account
}

/// Move on the first-sign-in prompt. Throws if the todos couldn't be moved.
typealias GuestTodoMover = @MainActor (_ guest: [Todo], _ session: AuthSession) async throws -> Void

/// Drives the TodoCore auth reducer; owns the guest/account lists' lifecycle (move, discard, wipe on sign out).
@MainActor
@Observable
final class AuthViewModel {
    static let ownerKey = "\(accountStorageKey):owner"
    static let syncCursorKey = "todo-tracker:sync-cursor:v1"

    private(set) var state = initialAuthState
    /// The signed-in user's id and access token, or nil while signed out.
    private(set) var session: AuthSession?
    private(set) var scope: TodoScope
    private(set) var resendSeconds = 0
    var mover: GuestTodoMover
    /// The last Move failed; the prompt stays up with an error.
    private(set) var moveFailed = false

    private let client: AuthClient
    private let guest: TodoStore
    private let account: TodoStore
    private let defaults: UserDefaults
    private var verifying = false
    private var listener: Task<Void, Never>?
    private var ticker: Task<Void, Never>?

    init(client: AuthClient, guest: TodoStore, account: TodoStore, defaults: UserDefaults = .standard) {
        self.client = client
        self.guest = guest
        self.account = account
        self.defaults = defaults
        // Read synchronously so a restored account opens straight on its cached list.
        scope = defaults.string(forKey: Self.ownerKey) == nil ? .guest : .account
        // Pushes the guest todos as new account rows; the account list pulls them in.
        mover = { todos, session in
            let rows = guestToRows(todos, userId: session.userId, now: Date())
            if !rows.isEmpty { _ = try await client.sync.push(rows) }
        }
        listener = Task { [weak self] in
            for await change in client.changes() {
                self?.handle(change)
            }
        }
    }

    /// The todos backend the signed-in account list syncs with.
    var syncServer: any SyncServer { client.sync }
    var realtime: any RealtimeTransport { client.realtime }

    var isSheetPresented: Bool { state.step != nil }
    var movePromptText: String? { state.movePrompt.map { t("auth.move.prompt", ["count": $0]) } }

    func open() { dispatch(.open) }
    func cancel() { dispatch(.cancel) }
    func changeEmail() { dispatch(.changeEmail) }

    func sendCode(_ email: String) {
        let before = state
        dispatch(.sendCode(email: email))
        guard isValidEmail(email), !before.busy else { return }
        Task {
            do {
                try await client.sendCode(email: state.email)
                dispatch(.codeSent(now: Self.now()))
                tickResend()
            } catch {
                dispatch(.failed(Self.kind(error)))
            }
        }
    }

    func resend() { sendCode(state.email) }

    func verify(_ input: String) {
        let code = normalizeCode(input)
        let before = state
        dispatch(.verify(code: code))
        guard isValidCode(code), !before.busy else { return }
        verifying = true
        Task {
            defer { verifying = false }
            do {
                let signedIn = try await client.verifyCode(email: before.email, code: code)
                let guestTodos = guest.load()
                claim(signedIn)
                session = signedIn
                dispatch(.signedIn(userId: signedIn.userId, email: signedIn.email, guestCount: guestTodos.count))
                if guestTodos.isEmpty { scope = .account }
            } catch {
                dispatch(.failed(Self.kind(error)))
            }
        }
    }

    /// Resolves the first-sign-in prompt; the guest list is wiped either way.
    func resolveGuestTodos(move: Bool) {
        guard let signedIn = session else { return }
        Task {
            moveFailed = false
            if move {
                do {
                    try await mover(guest.load(), signedIn)
                } catch {
                    moveFailed = true
                    return
                }
            }
            guest.save([])
            dispatch(.guestResolved)
            scope = .account
        }
    }

    func signOut() {
        Task {
            await client.signOut()
            endSession()
        }
    }

    /// Throws an `AuthFailure` (keeping the session) when the server call fails.
    func deleteAccount() async throws {
        try await client.deleteAccount()
        endSession()
    }

    /// Leaves the device as after sign out: account cache and cursor wiped, empty guest list.
    private func endSession() {
        wipeAccount()
        guest.save([])
        session = nil
        dispatch(.signedOut(initiated: true))
        scope = .guest
    }

    private func handle(_ change: AuthChange) {
        if let signedIn = change.session {
            session = signedIn
            if !verifying, state.status != .signedIn {
                claim(signedIn)
                dispatch(.signedIn(userId: signedIn.userId, email: signedIn.email, guestCount: 0))
                scope = .account
            }
        } else if state.status == .signedIn || change.initiated && state.status != .signedOut {
            session = nil
            dispatch(.signedOut(initiated: change.initiated))
        } else if scope == .account, state.status == .signedOut {
            // Restored with no session but a cached account list: the refresh token expired while closed.
            dispatch(.signedIn(userId: "", email: "", guestCount: 0))
            dispatch(.signedOut(initiated: false))
        }
    }

    /// Wipes the account cache when a different user signs in on this device.
    private func claim(_ signedIn: AuthSession) {
        if defaults.string(forKey: Self.ownerKey) != signedIn.userId { wipeAccount() }
        defaults.set(signedIn.userId, forKey: Self.ownerKey)
    }

    private func wipeAccount() {
        account.save([])
        defaults.removeObject(forKey: Self.ownerKey)
        defaults.removeObject(forKey: Self.syncCursorKey)
    }

    private func tickResend() {
        ticker?.cancel()
        ticker = Task {
            repeat {
                resendSeconds = resendSecondsLeft(state, now: Self.now())
                try? await Task.sleep(for: .seconds(1))
            } while resendSeconds > 0 && !Task.isCancelled
        }
    }

    private func dispatch(_ event: AuthEvent) { state = reduceAuth(state, event) }

    private static func now() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

    private static func kind(_ error: Error) -> TodoCore.AuthError {
        (error as? AuthFailure)?.kind ?? .unknown
    }
}
