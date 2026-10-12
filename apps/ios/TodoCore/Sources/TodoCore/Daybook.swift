import Foundation

/// The Today view's groups. Each keeps the input order (the user's chosen sort).
public struct DaybookSections: Equatable, Sendable {
    /// Open, due before today. Shown first, without guilt ("From Fri").
    public var slipped: [Todo] = []
    /// Open, due today or undated.
    public var today: [Todo] = []
    /// Open, due after today.
    public var later: [Todo] = []
    public var done: [Todo] = []

    public init() {}
}

public struct DaybookProgress: Codable, Equatable, Sendable {
    public let done: Int
    public let total: Int
}

public struct UpcomingDay: Equatable, Sendable {
    public let date: String
    public let todos: [Todo]
}

/// Splits todos into the Today view's groups; `today` is a YYYY-MM-DD key.
public func daybookSections(_ todos: [Todo], today: String) -> DaybookSections {
    var sections = DaybookSections()
    for todo in todos {
        if todo.completed {
            sections.done.append(todo)
        } else if let due = todo.dueDate, due < today {
            sections.slipped.append(todo)
        } else if let due = todo.dueDate, due > today {
            sections.later.append(todo)
        } else {
            sections.today.append(todo)
        }
    }
    return sections
}

/// Progress ring: todos completed today out of today's load (completed today plus open
/// slipped, due-today and undated todos), in `timeZone`.
public func daybookProgress(_ todos: [Todo], now: Date, timeZone: TimeZone = .current) -> DaybookProgress {
    let today = localDateKey(now, timeZone: timeZone)
    var done = 0
    var open = 0
    for todo in todos {
        if todo.completed {
            if let at = todo.completedAt.flatMap({ Timestamp.parse($0) }), localDateKey(at, timeZone: timeZone) == today
            {
                done += 1
            }
        } else if todo.dueDate.map({ $0 <= today }) ?? true {
            open += 1
        }
    }
    return DaybookProgress(done: done, total: done + open)
}

/// Open todos due today or later, one entry per due date, soonest first.
public func upcomingDays(_ todos: [Todo], today: String) -> [UpcomingDay] {
    var byDate: [String: [Todo]] = [:]
    for todo in todos where !todo.completed {
        guard let due = todo.dueDate, due >= today else { continue }
        byDate[due, default: []].append(todo)
    }
    return byDate.keys.sorted().map { UpcomingDay(date: $0, todos: byDate[$0] ?? []) }
}
