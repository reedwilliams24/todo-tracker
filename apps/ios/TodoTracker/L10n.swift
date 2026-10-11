import Foundation

typealias MessageParams = [String: any Sendable]

/// Format-argument order for a Localizable.xcstrings key; `plural` is the argument that picks the plural form.
struct MessageArgs: Sendable {
    let args: [String]
    let plural: String?

    init(_ args: [String], plural: String? = nil) {
        self.args = args
        self.plural = plural
    }
}

/// UI copy by spec/i18n/en.json key, read from Localizable.xcstrings (generated) so iOS picks the
/// language and plural form (spec/features/localization.md). Unknown keys render as the key.
func t(_ key: String, _ params: MessageParams = [:]) -> String {
    let format = Bundle.main.localizedString(forKey: key, value: nil, table: nil)
    guard let message = messageArgs[key] else { return format }
    var args: [any CVarArg] = []
    for name in message.args {
        if name == message.plural {
            args.append(count(params[name]))
        } else if let value = params[name] {
            args.append(String(describing: value))
        } else {
            args.append("")
        }
    }
    return String(format: format, locale: .current, arguments: args)
}

private func count(_ value: (any Sendable)?) -> Int {
    switch value {
    case let value as Int: value
    case let value as Double: Int(value)
    case let value as String: Int(value.trimmingCharacters(in: .whitespaces)) ?? 0
    default: 0
    }
}
