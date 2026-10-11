import TodoCore

/// `localization` ops; mirrors packages/spec/src/features/localization.ts.
extension FixtureOps {
    static var localizationOps: [String: Op] {
        [
            "messages": { _ in
                    return enMessages
            },
            "resolveLocale": { g in
                    let supported: [String]? = try g.decode("supported")
                    return resolveLocale(try g.decode("preferred", as: [String].self), supported: supported ?? Array(catalogs.keys))
            },
            "formatMessage": { g in
                    return formatMessage(try g.decode("locale"), try g.decode("message"), try g.params())
            },
            "translate": { g in
                    return Translator(locale: try g.decode("locale"))(try g.decode("key"), try g.params())
            },
        ]
    }
}

extension FixtureOps.Given {
    /// `given.params` as message parameters: strings stay strings, numbers become `Double`.
    func params() throws -> MessageParams {
        guard case .object(let fields)? = raw["params"] else { return [:] }
        return try fields.mapValues { value -> any Sendable in
            switch value {
            case .string(let text): return text
            case .number(let number): return number
            default: throw FixtureOps.BadGiven(description: "given.params value \(value) is not a string or number")
            }
        }
    }
}
