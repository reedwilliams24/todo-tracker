import Foundation
import Supabase
import TodoCore

/// The signed-in user, as later tickets (sync, delete account) need it.
struct AuthSession: Equatable, Sendable {
    let userId: String
    let email: String
    let accessToken: String
}

/// A session change: `initiated` is false when the session ended on its own (expired refresh token).
struct AuthChange: Sendable {
    let session: AuthSession?
    let initiated: Bool
}

struct AuthFailure: Error {
    let kind: TodoCore.AuthError
}

/// Email-code sign-in and the persisted session (supabase-swift keeps it in the Keychain).
protocol AuthClient: Sendable {
    /// The todos backend, as the signed-in user.
    var sync: any SyncServer { get }
    /// The Realtime socket live updates arrive on.
    var realtime: any RealtimeTransport { get }
    /// Emits the restored session first, then every sign-in, sign-out and expiry.
    func changes() -> AsyncStream<AuthChange>
    func sendCode(email: String) async throws
    func verifyCode(email: String, code: String) async throws -> AuthSession
    func signOut() async
    /// Deletes the user's todos and auth user on the server (`delete_account`), then ends the session like `signOut`.
    func deleteAccount() async throws
}

enum SupabaseConfig {
    /// Nil unless the build sets SUPABASE_URL and SUPABASE_ANON_KEY (Config/Supabase.xcconfig).
    static func client(bundle: Bundle = .main) -> AuthClient? {
        guard
            let url = (bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String).flatMap(URL.init(string:)),
            url.host != nil,
            let key = bundle.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String, !key.isEmpty
        else { return nil }
        return SupabaseAuthClient(client: SupabaseClient(supabaseURL: url, supabaseKey: key))
    }
}

private final class SupabaseAuthClient: AuthClient {
    private let client: SupabaseClient
    private let signingOut = SignOutFlag()
    let sync: any SyncServer
    let realtime: any RealtimeTransport

    init(client: SupabaseClient) {
        self.client = client
        sync = SupabaseSyncServer(client: client)
        realtime = SupabaseRealtimeTransport(client: client)
    }

    func changes() -> AsyncStream<AuthChange> {
        let auth = client.auth
        let signingOut = signingOut
        return AsyncStream { continuation in
            let task = Task {
                for await (event, session) in auth.authStateChanges {
                    switch event {
                    case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
                        let signedIn = session.flatMap { $0.isExpired ? nil : Self.authSession($0) }
                        if event == .initialSession || signedIn != nil {
                            continuation.yield(AuthChange(session: signedIn, initiated: true))
                        }
                    case .signedOut, .userDeleted:
                        continuation.yield(AuthChange(session: nil, initiated: await signingOut.take()))
                    default:
                        break
                    }
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func sendCode(email: String) async throws {
        try await mapErrors { try await client.auth.signInWithOTP(email: email, shouldCreateUser: true) }
    }

    func verifyCode(email: String, code: String) async throws -> AuthSession {
        try await mapErrors {
            let response = try await client.auth.verifyOTP(email: email, token: code, type: .email)
            guard let session = response.session else { throw AuthFailure(kind: .unknown) }
            return Self.authSession(session)
        }
    }

    func signOut() async {
        await signingOut.set()
        // The Realtime socket closes too; the local session is cleared even if the server call fails.
        await client.removeAllChannels()
        client.realtimeV2.disconnect()
        try? await client.auth.signOut(scope: .local)
    }

    func deleteAccount() async throws {
        _ = try await mapErrors { try await client.rpc("delete_account").execute() }
        await signingOut.set()
        await client.removeAllChannels()
        client.realtimeV2.disconnect()
        // The server already revoked every session along with the user.
        try? await client.auth.signOut(scope: .local)
    }

    private static func authSession(_ session: Session) -> AuthSession {
        AuthSession(
            userId: session.user.id.uuidString.lowercased(), email: session.user.email ?? "",
            accessToken: session.accessToken)
    }

    private func mapErrors<T>(_ body: () async throws -> T) async throws -> T {
        do {
            return try await body()
        } catch let failure as AuthFailure {
            throw failure
        } catch let error as Auth.AuthError {
            if case .api(_, let code, _, let response) = error {
                throw AuthFailure(kind: authErrorKind(status: response.statusCode, code: code.rawValue))
            }
            throw AuthFailure(kind: .unknown)
        } catch is URLError {
            throw AuthFailure(kind: .offline)
        } catch {
            throw AuthFailure(kind: .unknown)
        }
    }
}

/// `push_todos` + the incremental pull from spec/server.md, as the signed-in user (RLS).
private struct SupabaseSyncServer: SyncServer {
    let client: SupabaseClient

    private struct PushParams: Encodable, Sendable {
        let rows: [TodoRow]
    }

    func push(_ rows: [TodoRow]) async throws -> [TodoRow] {
        let data = try await client.rpc("push_todos", params: PushParams(rows: rows)).execute().data
        return try JSONDecoder().decode([TodoRow].self, from: data)
    }

    func pull(after cursor: Int64, limit: Int) async throws -> [TodoRow] {
        let data = try await client.from("todos").select()
            .gt("server_seq", value: String(cursor))
            .order("server_seq")
            .limit(limit)
            .execute().data
        return try JSONDecoder().decode([TodoRow].self, from: data)
    }
}

/// `RealtimeTransport` on supabase-swift: one socket (`client.realtimeV2`) and one channel per open.
private struct SupabaseRealtimeTransport: RealtimeTransport {
    let client: SupabaseClient

    func refreshAuth() async throws {
        // `session` refreshes the access token first if it has expired or is about to.
        let session = try await client.auth.session
        await client.realtimeV2.setAuth(session.accessToken)
    }

    func open(
        userId: String, onRow: @escaping @MainActor @Sendable (TodoRow) -> Void,
        onClosed: @escaping @MainActor @Sendable () -> Void
    ) async throws -> any RealtimeChannelHandle {
        let channel = client.channel(realtimeTopic(userId: userId).channel)
        let changes = channel.postgresChange(
            AnyAction.self, schema: realtimeSchema, table: realtimeTable, filter: .eq("user_id", value: userId))
        let statuses = channel.statusChange
        let handle = SupabaseRealtimeChannel(client: client, channel: channel)
        do {
            try await channel.subscribeWithError()
        } catch {
            await handle.close()
            throw error
        }
        let rows = Task {
            let decoder = JSONDecoder()
            for await change in changes {
                let row: TodoRow? =
                    switch change {
                    case .insert(let action): try? action.decodeRecord(as: TodoRow.self, decoder: decoder)
                    case .update(let action): try? action.decodeRecord(as: TodoRow.self, decoder: decoder)
                    default: nil
                    }
                if let row { await onRow(row) }
            }
        }
        let drops = Task {
            // `statusChange` replays the status from before the join first, so only a later change is a drop.
            var joined = false
            for await status in statuses {
                if status == .subscribed {
                    joined = true
                } else if joined {
                    await onClosed()
                    return
                }
            }
        }
        handle.tasks = [rows, drops]
        return handle
    }
}

private final class SupabaseRealtimeChannel: RealtimeChannelHandle, @unchecked Sendable {
    let client: SupabaseClient
    let channel: RealtimeChannelV2
    /// Set once, before the handle is shared.
    var tasks: [Task<Void, Never>] = []

    init(client: SupabaseClient, channel: RealtimeChannelV2) {
        self.client = client
        self.channel = channel
    }

    func close() async {
        for task in tasks { task.cancel() }
        // Drop the socket first so removal skips the `phx_leave` round trip: a backgrounding app can be
        // suspended mid-wait, leaving the socket open and the stale channel cached for the next open.
        client.realtimeV2.disconnect()
        await client.removeChannel(channel)
    }
}

/// Marks the next sign-out as user-initiated (vs. an expired refresh token).
private actor SignOutFlag {
    private var value = false
    func set() { value = true }
    func take() -> Bool {
        defer { value = false }
        return value
    }
}
