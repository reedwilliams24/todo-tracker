import TodoCore

/// `auth` ops; mirrors packages/spec/src/features/auth.ts.
extension FixtureOps {
    static var authOps: [String: Op] {
        [
            "authConstants": { _ in
                AuthConstants()
            },
            "authErrorKind": { g in
                authErrorKind(status: try g.decode("status", as: Int?.self), code: try g.decode("code", as: String?.self))
            },
            "isValidCode": { g in
                isValidCode(try g.decode("code"))
            },
            "isValidEmail": { g in
                isValidEmail(try g.decode("email"))
            },
            "normalizeCode": { g in
                normalizeCode(try g.decode("input"))
            },
            "reduceAuth": { g in
                try runAuth(g)
            },
            "resendSecondsLeft": { g in
                resendSecondsLeft(try runAuth(g), now: try g.decode("now"))
            },
        ]
    }

    private struct AuthConstants: Encodable {
        let accountStorageKey = TodoCore.accountStorageKey
        let codeLength = TodoCore.authCodeLength
        let resendMs = TodoCore.authResendMs
    }

    private struct RawAuthEvent: Decodable {
        let type: String
        let email: String?
        let now: Int64?
        let code: String?
        let error: AuthError?
        let userId: String?
        let guestCount: Int?
        let initiated: Bool?

        var event: AuthEvent {
            switch type {
            case "open": .open
            case "cancel": .cancel
            case "sendCode": .sendCode(email: email ?? "")
            case "codeSent": .codeSent(now: now ?? 0)
            case "verify": .verify(code: code ?? "")
            case "failed": .failed(error ?? .unknown)
            case "changeEmail": .changeEmail
            case "signedIn": .signedIn(userId: userId ?? "", email: email ?? "", guestCount: guestCount ?? 0)
            case "guestResolved": .guestResolved
            default: .signedOut(initiated: initiated ?? false)
            }
        }
    }

    private static func runAuth(_ g: Given) throws -> AuthState {
        try g.decode("events", as: [RawAuthEvent].self).map(\.event).reduce(initialAuthState, reduceAuth)
    }
}
