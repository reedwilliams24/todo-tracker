/// JavaScript `String.prototype.trim` whitespace (WhiteSpace + LineTerminator).
func isJSWhitespace(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
        return true
    default:
        return false
    }
}

extension String {
    /// Same result as JavaScript `trim()`.
    var jsTrimmed: String {
        let scalars = unicodeScalars
        guard let start = scalars.firstIndex(where: { !isJSWhitespace($0) }),
              let end = scalars.lastIndex(where: { !isJSWhitespace($0) })
        else { return "" }
        return String(scalars[start...end])
    }

    /// JavaScript `length` (UTF-16 code units).
    var jsLength: Int { utf16.count }
}
