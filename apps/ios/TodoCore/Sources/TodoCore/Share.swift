import Foundation

/// Most todos one share can add (spec/features/share.md).
public let maxSharedItems = 50

private let lineBreak = JSRegex(#"\r?\n"#)
private let whitespace = JSRegex(#"\s+"#)
private let shareKeys = ["add", "text", "title"]

/// Turns text shared from another app (or a `?add=` param) into drafts: one per non-empty line,
/// whitespace collapsed and trimmed, de-duplicated against each other and existing titles (case-insensitive).
public func draftsFromSharedText(_ texts: [String], existing: [Todo] = []) -> [TodoDraft] {
    var seen = Set(existing.map { $0.title.jsTrimmed.lowercased() })
    var drafts: [TodoDraft] = []
    for text in texts {
        for line in lineBreak.split(text) {
            let title = whitespace.replacingAll(in: line, with: " ").jsTrimmed
            let key = title.lowercased()
            if !isValidTitle(title) || seen.contains(key) { continue }
            seen.insert(key)
            drafts.append(TodoDraft(title: title))
            if drafts.count >= maxSharedItems { return drafts }
        }
    }
    return drafts
}

/// `add` (repeatable), then `text`, then `title` values from a query string, decoded like `URLSearchParams`.
public func sharedTextFromQuery(_ search: String) -> [String] {
    let query = search.hasPrefix("?") ? search.dropFirst() : Substring(search)
    let pairs: [(key: String, value: String)] = query.split(separator: "&").map { part in
        guard let eq = part.firstIndex(of: "=") else { return (formDecode(part), "") }
        return (formDecode(part[..<eq]), formDecode(part[part.index(after: eq)...]))
    }
    return shareKeys.flatMap { key in pairs.filter { $0.key == key }.map(\.value) }
}

/// application/x-www-form-urlencoded decoding: `+` is a space, malformed `%` escapes are kept.
private func formDecode(_ value: Substring) -> String {
    let bytes = Array(value.utf8)
    var out: [UInt8] = []
    out.reserveCapacity(bytes.count)
    var index = 0
    while index < bytes.count {
        let byte = bytes[index]
        if byte == UInt8(ascii: "%"), index + 2 < bytes.count,
           let hi = hexValue(bytes[index + 1]), let lo = hexValue(bytes[index + 2]) {
            out.append(hi << 4 | lo)
            index += 3
        } else {
            out.append(byte == UInt8(ascii: "+") ? UInt8(ascii: " ") : byte)
            index += 1
        }
    }
    return String(decoding: out, as: UTF8.self)
}

private func hexValue(_ byte: UInt8) -> UInt8? {
    switch byte {
    case UInt8(ascii: "0")...UInt8(ascii: "9"): byte - UInt8(ascii: "0")
    case UInt8(ascii: "a")...UInt8(ascii: "f"): byte - UInt8(ascii: "a") + 10
    case UInt8(ascii: "A")...UInt8(ascii: "F"): byte - UInt8(ascii: "A") + 10
    default: nil
    }
}
