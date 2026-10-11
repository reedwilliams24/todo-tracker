import Foundation

/// Email-code sign-in state; see spec/features/auth.md. Pure: the app's AuthService feeds it events.
public let authCodeLength = 6
public let authResendMs: Int64 = 60000
public let accountStorageKey = "todo-tracker:account:v1"

public enum AuthError: String, Codable, Sendable {
    case invalidEmail, wrongCode, rateLimited, offline, unknown
}

public enum AuthStatus: String, Codable, Sendable {
    case signedOut, signedIn, expired
}

public enum AuthStep: String, Codable, Sendable {
    case email, code
}

public struct AuthState: Equatable, Sendable, Encodable {
    public var status: AuthStatus = .signedOut
    /// The open sign-in form's step; nil when it is closed.
    public var step: AuthStep?
    public var email = ""
    public var userId: String?
    public var busy = false
    public var error: AuthError?
    /// Epoch ms after which a new code may be requested.
    public var resendAt: Int64?
    /// Guest todo count waiting on the Move/Discard prompt.
    public var movePrompt: Int?

    public init() {}

    private enum CodingKeys: String, CodingKey {
        case status, step, email, userId, busy, error, resendAt, movePrompt
    }

    /// Encodes nil fields as null, matching the fixtures.
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(status, forKey: .status)
        try c.encode(step, forKey: .step)
        try c.encode(email, forKey: .email)
        try c.encode(userId, forKey: .userId)
        try c.encode(busy, forKey: .busy)
        try c.encode(error, forKey: .error)
        try c.encode(resendAt, forKey: .resendAt)
        try c.encode(movePrompt, forKey: .movePrompt)
    }
}

public enum AuthEvent: Equatable, Sendable {
    case open
    case cancel
    case sendCode(email: String)
    case codeSent(now: Int64)
    case verify(code: String)
    case failed(AuthError)
    case changeEmail
    case signedIn(userId: String, email: String, guestCount: Int)
    case guestResolved
    case signedOut(initiated: Bool)
}

public let initialAuthState = AuthState()

private let rateLimitCodes: Set<String> = ["over_email_send_rate_limit", "over_request_rate_limit"]
private let wrongCodeCodes: Set<String> = ["otp_expired", "invalid_credentials", "otp_disabled"]
private let invalidEmailCodes: Set<String> = ["email_address_invalid", "validation_failed"]

public func normalizeEmail(_ email: String) -> String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
}

public func isValidEmail(_ email: String) -> Bool {
    normalizeEmail(email).range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
}

/// Keeps the digits of typed or pasted input ("123 456" -> "123456"), at most `authCodeLength`.
public func normalizeCode(_ input: String) -> String {
    String(input.filter { ("0"..."9").contains($0) }.prefix(authCodeLength))
}

public func isValidCode(_ code: String) -> Bool {
    code.count == authCodeLength && code.allSatisfy { ("0"..."9").contains($0) }
}

/// Whole seconds until Resend is allowed; 0 when it is.
public func resendSecondsLeft(_ state: AuthState, now: Int64) -> Int {
    guard let resendAt = state.resendAt else { return 0 }
    return max(0, Int((Double(resendAt - now) / 1000).rounded(.up)))
}

/// Maps an auth API failure (HTTP status, Supabase `error_code`) to the error shown. No status = offline.
public func authErrorKind(status: Int?, code: String?) -> AuthError {
    guard let status, status != 0 else { return .offline }
    if status == 429 || code.map(rateLimitCodes.contains) == true { return .rateLimited }
    if code.map(wrongCodeCodes.contains) == true { return .wrongCode }
    if code.map(invalidEmailCodes.contains) == true { return .invalidEmail }
    return status == 403 ? .wrongCode : .unknown
}

public func reduceAuth(_ state: AuthState, _ event: AuthEvent) -> AuthState {
    var next = state
    switch event {
    case .open, .changeEmail:
        next.step = .email
        next.busy = false
        next.error = nil
    case .cancel:
        next.step = nil
        next.busy = false
        next.error = nil
    case .sendCode(let email):
        guard !state.busy else { return state }
        next.email = normalizeEmail(email)
        if isValidEmail(next.email) {
            next.busy = true
            next.error = nil
        } else {
            next.error = .invalidEmail
        }
    case .codeSent(let now):
        next.step = .code
        next.busy = false
        next.error = nil
        next.resendAt = now + authResendMs
    case .verify(let code):
        guard !state.busy, isValidCode(code) else { return state }
        next.busy = true
        next.error = nil
    case .failed(let error):
        next.busy = false
        next.error = error
    case .signedIn(let userId, let email, let guestCount):
        next = initialAuthState
        next.status = .signedIn
        next.email = normalizeEmail(email)
        next.userId = userId
        next.movePrompt = guestCount > 0 ? guestCount : nil
    case .guestResolved:
        next.movePrompt = nil
    case .signedOut(let initiated):
        next = initialAuthState
        if !initiated, state.status != .signedOut {
            next.status = .expired
            next.email = state.email
            next.userId = state.userId
        }
    }
    return next
}
