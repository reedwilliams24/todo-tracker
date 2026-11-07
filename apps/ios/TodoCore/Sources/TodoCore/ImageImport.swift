import Foundation

/// Image → todos (spec/features/image-import.md).
public struct ImageImportConstants: Codable, Equatable, Sendable {
    public let acceptedTypes: [String]
    public let maxBytes: Int
    public let maxDimension: Int
    public let jpegQuality: Double
    public let maxTodos: Int
}

public let imageImport = ImageImportConstants(
    acceptedTypes: ["image/heic", "image/heif", "image/jpeg", "image/png", "image/webp"],
    maxBytes: 3_000_000,
    maxDimension: 2048,
    jpegQuality: 0.85,
    maxTodos: 50
)

/// Error codes shown as `image.error.<rawValue>`.
public enum ImageImportError: String, Codable, CaseIterable, Error, Sendable {
    case busy, failed, invalid, offline, tooLarge, unavailable, unsupported
}

/// Validates an image before it is sent: `ok`, `invalid`, `tooLarge` or `unsupported`.
public func checkImageUpload(mimeType: String, bytes: Int) -> String {
    if !imageImport.acceptedTypes.contains(mimeType.lowercased()) { return "unsupported" }
    if bytes <= 0 { return "invalid" }
    if bytes > imageImport.maxBytes { return "tooLarge" }
    return "ok"
}

/// Maps a failed `/api/image-todos` response to the error the client shows.
public func imageImportErrorFor(status: Int, body: JSONValue) -> ImageImportError {
    if case .object(let fields) = body, case .string(let code)? = fields["error"],
        let error = ImageImportError(rawValue: code)
    {
        return error
    }
    switch status {
    case 400: return .invalid
    case 413: return .tooLarge
    case 415: return .unsupported
    case 429: return .busy
    case 503: return .unavailable
    default: return .failed
    }
}

private let bulletPattern = JSRegex(#"^(?:[-*•◦▪·]|\[ ?\]|☐|\d{1,3}[.)])\s+"#)
private let whitespacePattern = JSRegex(#"\s+"#)
private let calendarDatePattern = JSRegex(#"^(\d{4})-(\d{2})-(\d{2})$"#)

private func collapse(_ text: String) -> String {
    whitespacePattern.replacingAll(in: text, with: " ").jsTrimmed
}

private func isCalendarDate(_ value: String) -> Bool {
    guard let groups = calendarDatePattern.firstMatch(in: value),
        let year = Int(groups[1] ?? ""), let month = Int(groups[2] ?? ""), let day = Int(groups[3] ?? "")
    else { return false }
    guard (1...12).contains(month), day >= 1 else { return false }
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
    let days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return day <= days
}

/// Validates untrusted model output for an image into drafts: keeps the model's wording, strips list
/// bullets, drops invalid fields and duplicate titles, and caps the count.
public func coerceImageDrafts(_ value: JSONValue) -> [TodoDraft] {
    let items: [JSONValue]
    switch value {
    case .array(let array): items = array
    case .object(let fields):
        if case .array(let array)? = fields["todos"] { items = array } else { items = [] }
    default: items = []
    }

    var drafts: [TodoDraft] = []
    var seen = Set<String>()
    for item in items {
        if drafts.count >= imageImport.maxTodos { break }
        let fields: [String: JSONValue]
        switch item {
        case .string(let title): fields = ["title": .string(title)]
        case .object(let object): fields = object
        default: continue
        }
        guard case .string(let title)? = fields["title"] else { continue }
        let cleaned = collapse(bulletPattern.replacingFirst(in: collapse(title), with: ""))
        guard isValidTitle(cleaned) else { continue }
        let key = cleaned.lowercased()
        guard seen.insert(key).inserted else { continue }
        var notes: String?
        if case .string(let raw)? = fields["notes"] {
            let trimmed = raw.jsTrimmed
            if !trimmed.isEmpty, trimmed.lowercased() != key { notes = trimmed }
        }
        var priority: TodoPriority?
        if case .string(let raw)? = fields["priority"] { priority = TodoPriority(rawValue: raw) }
        var dueDate: String?
        if case .string(let raw)? = fields["dueDate"], isCalendarDate(raw) { dueDate = raw }
        drafts.append(TodoDraft(title: cleaned, notes: notes, priority: priority, dueDate: dueDate))
    }
    return drafts
}
