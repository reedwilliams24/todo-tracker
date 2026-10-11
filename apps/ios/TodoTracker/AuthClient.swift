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

    init(client: SupabaseClient) {
        self.client = client
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
        // REED-68's Realtime channel closes here too; the local session is cleared even if the server call fails.
        await client.removeAllChannels()
        try? await client.auth.signOut(scope: .local)
    }

    func deleteAccount() async throws {
        _ = try await mapErrors { try await client.rpc("delete_account").execute() }
        await signingOut.set()
        await client.removeAllChannels()
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

/// Marks the next sign-out as user-initiated (vs. an expired refresh token).
private actor SignOutFlag {
    private var value = false
    func set() { value = true }
    func take() -> Bool {
        defer { value = false }
        return value
    }
}
