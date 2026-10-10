import Foundation

/// `NSRegularExpression` with JavaScript semantics for the subset the shared TS code uses:
/// ASCII `\b`, JS `\s`, ASCII `\d`, `$` = end of input, and `replace` hitting only the first match.
struct JSRegex: @unchecked Sendable {
    private let regex: NSRegularExpression

    init(_ pattern: String, ignoreCase: Bool = false) {
        // swiftlint:disable:next force_try
        regex = try! NSRegularExpression(
            pattern: JSRegex.translate(pattern),
            options: ignoreCase ? [.caseInsensitive] : []
        )
    }

    private func fullRange(_ text: String) -> NSRange {
        NSRange(location: 0, length: (text as NSString).length)
    }

    func test(_ text: String) -> Bool {
        regex.firstMatch(in: text, range: fullRange(text)) != nil
    }

    /// JavaScript `text.replace(regex, replacement)` without the `g` flag.
    func replacingFirst(in text: String, with replacement: String) -> String {
        guard let match = regex.firstMatch(in: text, range: fullRange(text)) else { return text }
        return (text as NSString).replacingCharacters(in: match.range, with: replacement)
    }

    /// JavaScript `text.replace(regex, replacement)` with the `g` flag.
    func replacingAll(in text: String, with replacement: String) -> String {
        regex.stringByReplacingMatches(
            in: text,
            range: fullRange(text),
            withTemplate: NSRegularExpression.escapedTemplate(for: replacement)
        )
    }

    /// JavaScript `text.split(regex)` for patterns that never match the empty string.
    func split(_ text: String) -> [String] {
        let ns = text as NSString
        var parts: [String] = []
        var start = 0
        for match in regex.matches(in: text, range: fullRange(text)) where match.range.length > 0 {
            parts.append(ns.substring(with: NSRange(location: start, length: match.range.location - start)))
            start = match.range.location + match.range.length
        }
        parts.append(ns.substring(from: start))
        return parts
    }

    private static let space = #"\t\n\x{0B}\f\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}"#
    private static let word = "(?-i:[A-Za-z0-9_])"
    private static let boundary = "(?:(?<=\(word))(?!\(word))|(?<!\(word))(?=\(word)))"

    /// Rewrites JS-only escapes into ICU equivalents.
    static func translate(_ pattern: String) -> String {
        let chars = Array(pattern)
        var out = ""
        var inClass = false
        var index = 0
        while index < chars.count {
            let char = chars[index]
            if char == "\\", index + 1 < chars.count {
                let next = chars[index + 1]
                switch next {
                case "s": out += inClass ? space : "[\(space)]"
                case "d": out += inClass ? "0-9" : "[0-9]"
                case "b" where !inClass: out += boundary
                default: out.append(char); out.append(next)
                }
                index += 2
                continue
            }
            if char == "[", !inClass {
                inClass = true
            } else if char == "]", inClass {
                inClass = false
            } else if char == "$", !inClass {
                out += #"\z"#
                index += 1
                continue
            }
            out.append(char)
            index += 1
        }
        return out
    }
}
