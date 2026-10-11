import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import TodoCore

struct AuthUser: Codable, Equatable, Sendable {
    let id: String
    let email: String?
}

struct AuthSession: Codable, Equatable, Sendable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Int
    var user: AuthUser
}

struct SupabaseError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

let authRedirect = "todotracker://auth"

/// Minimal Supabase Auth (GoTrue) + PostgREST client over URLSession; only the anon key ships.
struct SupabaseClient: Sendable {
    let config: CloudConfig

    private var base: String { config.url.hasSuffix("/") ? String(config.url.dropLast()) : config.url }

    func sendCode(email: String) async throws {
        _ = try await request("POST", "/auth/v1/otp", body: OtpBody(email: email))
    }

    func verifyCode(email: String, code: String) async throws -> AuthSession {
        try session(from: try await request("POST", "/auth/v1/verify", body: VerifyBody(email: email, token: code)))
    }

    func refresh(_ session: AuthSession) async throws -> AuthSession {
        try self.session(from: try await request(
            "POST", "/auth/v1/token?grant_type=refresh_token", body: RefreshBody(refresh_token: session.refreshToken)
        ))
    }

    func authorizeURL(provider: String) -> URL? {
        URL(string: "\(base)/auth/v1/authorize?provider=\(provider)&redirect_to=\(encode(authRedirect))")
    }

    /// Completes an OAuth redirect: `todotracker://auth#access_token=…&refresh_token=…&expires_in=…`.
    func session(fromRedirect url: URL) async throws -> AuthSession {
        let params = Self.params(url)
        if let message = params["error_description"] { throw SupabaseError(status: 400, message: message) }
        guard let accessToken = params["access_token"] else { throw SupabaseError(status: 400, message: "Sign-in was cancelled.") }
        let user = try JSONDecoder().decode(AuthUser.self, from: try await request("GET", "/auth/v1/user", token: accessToken))
        return AuthSession(
            accessToken: accessToken,
            refreshToken: params["refresh_token"] ?? "",
            expiresAt: Self.nowSeconds() + (params["expires_in"].flatMap(Int.init) ?? 3600),
            user: user
        )
    }

    func signOut(_ session: AuthSession) async {
        _ = try? await request("POST", "/auth/v1/logout", token: session.accessToken)
    }

    func listTodos(token: String, userId: String) async throws -> [TodoRow] {
        try JSONDecoder().decode([TodoRow].self, from: try await request("GET", "/rest/v1/todos?select=*&user_id=eq.\(encode(userId))", token: token))
    }

    func upsertTodos(token: String, rows: [TodoRow]) async throws {
        _ = try await request(
            "POST", "/rest/v1/todos?on_conflict=id", body: rows, token: token,
            headers: ["Prefer": "resolution=merge-duplicates,return=minimal"]
        )
    }

    func removeTodos(token: String, userId: String, ids: [String]) async throws {
        let list = ids.map { "\"\($0.replacingOccurrences(of: "\"", with: ""))\"" }.joined(separator: ",")
        _ = try await request("DELETE", "/rest/v1/todos?user_id=eq.\(encode(userId))&id=in.\(encode("(\(list))"))", token: token)
    }

    // MARK: - HTTP

    private struct OtpBody: Encodable {
        let email: String
        var create_user = true
    }

    private struct VerifyBody: Encodable {
        var type = "email"
        let email: String
        let token: String
    }

    private struct RefreshBody: Encodable {
        let refresh_token: String
    }

    private struct SessionBody: Decodable {
        let access_token: String
        let refresh_token: String?
        let expires_in: Int?
        let expires_at: Int?
        let user: AuthUser
    }

    private struct ErrorBody: Decodable {
        let msg: String?
        let message: String?
        let error_description: String?
    }

    private struct NoBody: Encodable {}

    private func request(
        _ method: String,
        _ path: String,
        body: (some Encodable)? = NoBody?.none,
        token: String? = nil,
        headers: [String: String] = [:]
    ) async throws -> Data {
        guard let url = URL(string: base + path) else { throw SupabaseError(status: 0, message: "Bad Supabase URL.") }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = method
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token ?? config.anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        if let body { request.httpBody = try JSONEncoder().encode(body) }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let error = try? JSONDecoder().decode(ErrorBody.self, from: data)
            throw SupabaseError(
                status: status,
                message: error?.msg ?? error?.message ?? error?.error_description ?? "Request failed (\(status))"
            )
        }
        return data
    }

    private func session(from data: Data) throws -> AuthSession {
        let body = try JSONDecoder().decode(SessionBody.self, from: data)
        return AuthSession(
            accessToken: body.access_token,
            refreshToken: body.refresh_token ?? "",
            expiresAt: body.expires_at ?? (Self.nowSeconds() + (body.expires_in ?? 3600)),
            user: body.user
        )
    }

    private func encode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    static func params(_ url: URL) -> [String: String] {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        var query = URLComponents()
        query.percentEncodedQuery = components?.percentEncodedFragment ?? components?.percentEncodedQuery
        return Dictionary(
            (query.queryItems ?? []).compactMap { item in item.value.map { (item.name, $0) } },
            uniquingKeysWith: { _, last in last }
        )
    }

    static func nowSeconds() -> Int { Int(Date().timeIntervalSince1970) }
}

/// Keeps the signed-in session (and per-account migration flags) on the device; refreshes the token when needed.
@MainActor
final class AccountSession {
    let client: SupabaseClient
    private let defaults: UserDefaults
    private(set) var session: AuthSession?

    private static let sessionKey = "todo-tracker:session"

    init(client: SupabaseClient, defaults: UserDefaults = .standard) {
        self.client = client
        self.defaults = defaults
        session = defaults.data(forKey: Self.sessionKey).flatMap { try? JSONDecoder().decode(AuthSession.self, from: $0) }
    }

    func store(_ session: AuthSession?) {
        self.session = session
        if let session, let data = try? JSONEncoder().encode(session) {
            defaults.set(data, forKey: Self.sessionKey)
        } else {
            defaults.removeObject(forKey: Self.sessionKey)
        }
    }

    func signOut() async {
        if let session { await client.signOut(session) }
        store(nil)
    }

    func isMigrated(_ userId: String) -> Bool { defaults.bool(forKey: migrationKey(userId: userId)) }
    func setMigrated(_ userId: String) { defaults.set(true, forKey: migrationKey(userId: userId)) }

    /// Runs `block` with a valid access token, refreshing once if it is about to expire or is rejected.
    func authorized<T: Sendable>(_ block: @Sendable (String) async throws -> T) async throws -> T {
        guard var current = session else { throw SupabaseError(status: 401, message: "Not signed in.") }
        if current.expiresAt - 60 < SupabaseClient.nowSeconds() {
            current = try await client.refresh(current)
            store(current)
        }
        do {
            return try await block(current.accessToken)
        } catch let error as SupabaseError where error.status == 401 {
            let refreshed = try await client.refresh(current)
            store(refreshed)
            return try await block(refreshed.accessToken)
        }
    }
}

/// The account's `todos` rows; saves send only the diff from the last load/save (planCloudSave).
@MainActor
final class CloudTodoStore {
    private let account: AccountSession
    let userId: String
    private var known: [CloudVersion] = []

    init(account: AccountSession, userId: String) {
        self.account = account
        self.userId = userId
    }

    func load() async throws -> [Todo] {
        let client = account.client
        let userId = userId
        let todos = try await account.authorized { try await client.listTodos(token: $0, userId: userId) }.map(fromRow)
        known = cloudVersions(todos)
        return todos
    }

    func save(_ todos: [Todo]) async throws {
        let client = account.client
        let userId = userId
        let plan = planCloudSave(known: known, todos: todos)
        if !plan.changed.isEmpty {
            let rows = plan.changed.map { toRow($0, userId: userId) }
            try await account.authorized { try await client.upsertTodos(token: $0, rows: rows) }
        }
        if !plan.removed.isEmpty {
            let ids = plan.removed
            try await account.authorized { try await client.removeTodos(token: $0, userId: userId, ids: ids) }
        }
        known = cloudVersions(todos)
    }
}
