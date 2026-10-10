import Foundation

// Regex fallback for voice capture; a line-by-line port of packages/shared/src/voice.ts.
// Patterns go through JSRegex so `\b`, `\s` and `replace` keep JavaScript semantics.

private let separator = JSRegex(
    #"\s*(?:\band then\b|\bafter that\b|\balso\b|\band also\b|[;\n]|,\s*(?=and\s)|\.\s+)\s*"#,
    ignoreCase: true
)

private let priorityPatterns: [(JSRegex, TodoPriority)] = [
    (JSRegex(#"\b(urgent(ly)?|asap|critical|high priority|important)\b"#, ignoreCase: true), .high),
    (JSRegex(#"\b(low priority|whenever|no rush|someday|eventually)\b"#, ignoreCase: true), .low),
    (JSRegex(#"\b(medium priority|normal priority)\b"#, ignoreCase: true), .medium),
]

private let weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
private let weekdayPatterns = weekdays.map { JSRegex(#"\b(?:on|by|next)?\s*"# + $0 + #"\b"#, ignoreCase: true) }

private let leadingFiller = JSRegex(
    #"^(?:(?:um|uh|ok|okay|so|hey|please|remind me to|i need to|i have to|i want to|remember to|add (?:a )?(?:todo|task|item)(?: to| for)?|create (?:a )?(?:todo|task)(?: to| for)?|make (?:a )?note to|let's|lets)(?:[\s,.!?]+|$))+"#,
    ignoreCase: true
)
private let leadingPunctuation = JSRegex(#"^[\s.,!?]+"#)
private let trailingFiller = JSRegex(#"[\s.,!?]+$"#)
private let whitespaceRun = JSRegex(#"\s+"#)

private let today = JSRegex(#"\btoday\b"#, ignoreCase: true)
private let tonight = JSRegex(#"\btonight\b"#, ignoreCase: true)
private let tomorrow = JSRegex(#"\btomorrow\b"#, ignoreCase: true)
private let nextWeek = JSRegex(#"\bnext week\b"#, ignoreCase: true)

public struct PriorityExtraction: Codable, Equatable, Sendable {
    public var priority: TodoPriority?
    public var rest: String
}

public struct DueDateExtraction: Codable, Equatable, Sendable {
    public var dueDate: String?
    public var rest: String
}

private func localCalendar(_ timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
}

private func toIsoDate(_ date: Date, _ calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
}

private func addDays(_ date: Date, _ days: Int, _ calendar: Calendar) -> Date {
    calendar.date(byAdding: .day, value: days, to: date)!
}

public func extractPriority(_ text: String) -> PriorityExtraction {
    for (pattern, priority) in priorityPatterns where pattern.test(text) {
        return PriorityExtraction(priority: priority, rest: pattern.replacingFirst(in: text, with: " "))
    }
    return PriorityExtraction(priority: nil, rest: text)
}

/// Dates are computed in the device's local time zone.
public func extractDueDate(_ text: String, now: Date = Date(), timeZone: TimeZone = .current) -> DueDateExtraction {
    let calendar = localCalendar(timeZone)
    let relative: [(JSRegex, Int)] = [(today, 0), (tonight, 0), (tomorrow, 1), (nextWeek, 7)]
    for (pattern, days) in relative where pattern.test(text) {
        return DueDateExtraction(
            dueDate: toIsoDate(addDays(now, days, calendar), calendar),
            rest: pattern.replacingFirst(in: text, with: " ")
        )
    }

    let todayIndex = calendar.component(.weekday, from: now) - 1
    for (index, pattern) in weekdayPatterns.enumerated() where pattern.test(text) {
        let delta = (index - todayIndex + 7) % 7
        return DueDateExtraction(
            dueDate: toIsoDate(addDays(now, delta == 0 ? 7 : delta, calendar), calendar),
            rest: pattern.replacingFirst(in: text, with: " ")
        )
    }

    return DueDateExtraction(dueDate: nil, rest: text)
}

public func cleanTitle(_ text: String) -> String {
    var result = leadingPunctuation.replacingFirst(in: text, with: "")
    result = leadingFiller.replacingFirst(in: result, with: "")
    result = whitespaceRun.replacingAll(in: result, with: " ")
    result = trailingFiller.replacingFirst(in: result, with: "")
    return result.jsTrimmed
}

/// Splits a spoken transcript into todo drafts without an LLM.
public func parseTranscript(_ transcript: String, now: Date = Date(), timeZone: TimeZone = .current) -> [TodoDraft] {
    separator.split(transcript)
        .map { segment in
            let withoutPriority = extractPriority(segment)
            let withoutDueDate = extractDueDate(withoutPriority.rest, now: now, timeZone: timeZone)
            return TodoDraft(
                title: cleanTitle(withoutDueDate.rest),
                priority: withoutPriority.priority,
                dueDate: withoutDueDate.dueDate
            )
        }
        .filter { isValidTitle($0.title) }
}

private let stopwords: Set<String> = ["a", "an", "and", "for", "my", "me", "the", "to", "up", "with"]

private func contentWords(_ title: String) -> Set<String> {
    var words = Set<String>()
    var current = String.UnicodeScalarView()
    func flush() {
        let word = String(current)
        if word.count > 1, !stopwords.contains(word) { words.insert(word) }
        current = String.UnicodeScalarView()
    }
    for scalar in title.lowercased().unicodeScalars {
        if ("a"..."z").contains(scalar) || ("0"..."9").contains(scalar) {
            current.append(scalar)
        } else {
            flush()
        }
    }
    flush()
    return words
}

private func describesSameTask(_ a: String, _ b: String) -> Bool {
    !contentWords(a).isDisjoint(with: contentWords(b))
}

/// Merges model output with the regex parse, keeping the model's wording but recovering dropped tasks.
public func reconcileDrafts(heuristic: [TodoDraft], llm: [TodoDraft]) -> [TodoDraft] {
    if llm.isEmpty { return heuristic }

    var unmatched = Array(llm.indices)
    var merged: [TodoDraft] = []
    for draft in heuristic {
        if let position = unmatched.firstIndex(where: { describesSameTask(llm[$0].title, draft.title) }) {
            merged.append(llm[unmatched.remove(at: position)])
        } else {
            merged.append(draft)
        }
    }
    return merged + unmatched.map { llm[$0] }
}

private let isoDatePattern = JSRegex(#"^\d{4}-\d{2}-\d{2}$"#)

/// Validates untrusted model output (`{todos: [...]}` or a bare array) into drafts.
public func coerceDrafts(_ value: JSONValue) -> [TodoDraft] {
    let items: [JSONValue]
    switch value {
    case .array(let array): items = array
    case .object(let fields):
        if case .array(let array)? = fields["todos"] { items = array } else { items = [] }
    default: items = []
    }

    var drafts: [TodoDraft] = []
    for item in items {
        let fields: [String: JSONValue]
        switch item {
        case .string(let title): fields = ["title": .string(title)]
        case .object(let object): fields = object
        default: continue
        }
        guard case .string(let title)? = fields["title"] else { continue }
        let cleaned = cleanTitle(title)
        guard isValidTitle(cleaned) else { continue }
        var priority: TodoPriority?
        if case .string(let raw)? = fields["priority"] { priority = TodoPriority(rawValue: raw) }
        var dueDate: String?
        if case .string(let raw)? = fields["dueDate"], isoDatePattern.test(raw) { dueDate = raw }
        drafts.append(TodoDraft(title: cleaned, priority: priority, dueDate: dueDate))
    }
    return drafts
}
