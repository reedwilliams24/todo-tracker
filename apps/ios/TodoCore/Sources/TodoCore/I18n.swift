import Foundation

/// Localized UI copy (spec/features/localization.md). Only English ships; see Messages.swift.
public let defaultLocale = "en"

public let catalogs: [String: [String: String]] = [defaultLocale: enMessages]

public typealias MessageParams = [String: any Sendable]

private func language(_ tag: String) -> String {
    let lower = tag.lowercased()
    return String(lower.split(whereSeparator: { $0 == "-" || $0 == "_" }).first ?? Substring(lower))
}

/// First supported locale for the user's preferred BCP 47 tags; exact match, then language subtag.
public func resolveLocale(_ preferred: [String?], supported: [String] = Array(catalogs.keys)) -> String {
    for case let tag? in preferred where !tag.isEmpty {
        let lower = tag.lowercased()
        if let exact = supported.first(where: { $0.lowercased() == lower }) { return exact }
        let lang = language(tag)
        if let byLang = supported.first(where: { language($0) == lang }) { return byLang }
    }
    return defaultLocale
}

/// Splits `one {…} other {…}` into selector → branch, honouring nested braces.
private func parseBranches(_ source: [Character]) -> [String: String] {
    var options: [String: String] = [:]
    var i = 0
    while i < source.count {
        guard let open = source[i...].firstIndex(of: "{") else { break }
        let selector = String(source[i..<open]).trimmingCharacters(in: .whitespacesAndNewlines)
        var depth = 0
        var close = open
        while close < source.count {
            if source[close] == "{" { depth += 1 } else if source[close] == "}" {
                depth -= 1
                if depth == 0 { break }
            }
            close += 1
        }
        if options[selector] == nil { options[selector] = String(source[(open + 1)..<min(close, source.count)]) }
        i = close + 1
    }
    return options
}

/// English plural rules; add CLDR rules here when a second catalog ships.
private func pluralCategory(_ count: Double) -> String { count == 1 ? "one" : "other" }

private func countKey(_ count: Double) -> String {
    count.rounded() == count && count.isFinite ? String(Int64(count)) : String(count)
}

private func toCount(_ raw: (any Sendable)?) -> Double {
    switch raw {
    case nil: return 0
    case let value as Int: return Double(value)
    case let value as Int64: return Double(value)
    case let value as Double: return value
    case let value as String:
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? 0 : Double(trimmed) ?? .nan
    default: return .nan
    }
}

private func paramString(_ value: any Sendable) -> String {
    switch value {
    case let double as Double: return countKey(double)
    default: return "\(value)"
    }
}

private func isWord(_ char: Character) -> Bool {
    char.isASCII && (char.isLetter || char.isNumber || char == "_")
}

/// Index just past `{name` (ASCII word characters) starting at `open`, or nil.
private func wordEnd(_ chars: [Character], after open: Int) -> Int? {
    var j = open + 1
    while j < chars.count, isWord(chars[j]) { j += 1 }
    return j > open + 1 ? j : nil
}

/// Finds the first `{name, plural, …}` block; `body` is the range of its branches.
private func findPlural(_ chars: [Character]) -> (start: Int, end: Int, name: String, body: Range<Int>)? {
    let keyword = Array("plural,")
    for open in chars.indices where chars[open] == "{" {
        guard let nameEnd = wordEnd(chars, after: open), nameEnd < chars.count, chars[nameEnd] == "," else { continue }
        var k = nameEnd + 1
        while k < chars.count, chars[k].isWhitespace { k += 1 }
        guard k + keyword.count <= chars.count, Array(chars[k..<(k + keyword.count)]) == keyword else { continue }
        var depth = 0
        for i in open..<chars.count {
            if chars[i] == "{" { depth += 1 } else if chars[i] == "}" {
                depth -= 1
                if depth == 0 {
                    return (open, i + 1, String(chars[(open + 1)..<nameEnd]), (k + keyword.count)..<i)
                }
            }
        }
        return nil
    }
    return nil
}

/// `{name}` interpolation and `{count, plural, =N {…} one {…} other {…}}` selection (`#` = the number).
public func formatMessage(_ locale: String, _ message: String, _ params: MessageParams = [:]) -> String {
    var chars = Array(message)
    while let plural = findPlural(chars) {
        let count = toCount(params[plural.name])
        let options = parseBranches(Array(chars[plural.body]))
        let branch = options["=\(countKey(count))"] ?? options[pluralCategory(count)] ?? options["other"] ?? ""
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: locale)
        formatter.numberStyle = .decimal
        let number = formatter.string(from: NSNumber(value: count)) ?? countKey(count)
        chars = Array(chars[..<plural.start]) + Array(branch.replacingOccurrences(of: "#", with: number)) + Array(chars[plural.end...])
    }
    var out = ""
    var i = 0
    while i < chars.count {
        if chars[i] == "{", let nameEnd = wordEnd(chars, after: i), nameEnd < chars.count, chars[nameEnd] == "}",
           let value = params[String(chars[(i + 1)..<nameEnd])] {
            out += paramString(value)
            i = nameEnd + 1
        } else {
            out.append(chars[i])
            i += 1
        }
    }
    return out
}

/// Formats catalog messages for one locale; unsupported locales use English, unknown keys render as the key.
public struct Translator: Sendable {
    public let locale: String
    private let catalog: [String: String]

    public init(locale: String) {
        self.locale = catalogs[locale] == nil ? defaultLocale : locale
        catalog = catalogs[self.locale] ?? enMessages
    }

    public init(preferredLanguages: [String]) {
        self.init(locale: resolveLocale(preferredLanguages))
    }

    public func callAsFunction(_ key: String, _ params: MessageParams = [:]) -> String {
        formatMessage(locale, catalog[key] ?? enMessages[key] ?? key, params)
    }
}
