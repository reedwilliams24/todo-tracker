import Foundation

// Port of apps/web/src/domain/quick-add.ts (spec/features/quick-add.md).

public struct QuickAddParse: Codable, Equatable, Sendable {
    public var title: String
    public var priority: TodoPriority?
    public var dueDate: String?
    public var tags: [String]

    public init(title: String, priority: TodoPriority? = nil, dueDate: String? = nil, tags: [String] = []) {
        self.title = title
        self.priority = priority
        self.dueDate = dueDate
        self.tags = tags
    }
}

private let tagPattern = JSRegex(#"(^|\s)#([\p{L}\p{N}_-]+)"#)
private let bangPriority = JSRegex(#"(^|\s)!(p[123]|high|med(?:ium)?|low)\b"#, ignoreCase: true)
private let isoDate = JSRegex(#"(^|\s)(?:on |by |due )?(\d{4}-\d{2}-\d{2})\b"#, ignoreCase: true)
private let inDays = JSRegex(#"\bin (\d{1,3}) days?\b"#, ignoreCase: true)

private let bangMap: [String: TodoPriority] = [
    "p1": .high, "p2": .medium, "p3": .low,
    "high": .high, "med": .medium, "medium": .medium, "low": .low,
]

/// Parses quick-add shorthand such as `call mom tomorrow 5pm #family !p1`: `#tag` -> tags,
/// `!p1`/`!high` -> priority, natural dates -> dueDate. Dates use the device's local time zone.
public func parseQuickAdd(_ input: String, now: Date = Date(), timeZone: TimeZone = .current) -> QuickAddParse {
    var tags: [String] = []
    var rest = tagPattern.replacingAll(in: input) { groups in
        let tag = (groups[2] ?? "").lowercased()
        if !tags.contains(tag) { tags.append(tag) }
        return groups[1] ?? ""
    }

    let priority: TodoPriority?
    if let bang = bangPriority.firstMatch(in: rest), let token = bang[2] {
        priority = bangMap[token.lowercased()]
        rest = bangPriority.replacingFirst(in: rest, with: " ")
    } else {
        let spoken = extractPriority(rest)
        priority = spoken.priority
        rest = spoken.rest
    }

    let dueDate: String?
    let iso = isoDate.firstMatch(in: rest)?[2]
    let days = inDays.firstMatch(in: rest)?[1]
    if let iso, isValidDueDate(iso) {
        dueDate = iso
        rest = isoDate.replacingFirst(in: rest, with: " ")
    } else if let days, let count = Int(days) {
        let calendar = localCalendar(timeZone)
        dueDate = toIsoDate(addDays(now, count, calendar), calendar)
        rest = inDays.replacingFirst(in: rest, with: " ")
    } else {
        let spoken = extractDueDate(rest, now: now, timeZone: timeZone)
        dueDate = spoken.dueDate
        rest = spoken.rest
    }

    return QuickAddParse(title: cleanTitle(rest), priority: priority, dueDate: dueDate, tags: tags)
}

/// True when the input contains any shorthand worth previewing.
public func hasQuickAddMeta(_ parse: QuickAddParse) -> Bool {
    parse.priority != nil || parse.dueDate != nil || !parse.tags.isEmpty
}

public func quickAddToDraft(_ parse: QuickAddParse, fallbackPriority: TodoPriority, fallbackDueDate: String? = nil) -> TodoDraft {
    TodoDraft(
        title: parse.title,
        priority: parse.priority ?? fallbackPriority,
        dueDate: parse.dueDate ?? (fallbackDueDate?.isEmpty == false ? fallbackDueDate : nil)
    )
}
