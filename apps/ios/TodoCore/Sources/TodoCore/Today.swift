import Foundation

public let todayLimit = 5

/// What the home-screen widget shows (spec/features/today.md).
public struct TodaySummary: Codable, Equatable, Sendable {
    public var todos: [Todo]
    public var dueToday: Int
    public var overdue: Int
    public var remaining: Int
}

/// Open todos due today or earlier, then undated ones, each sorted for display.
/// "Today" is the calendar date of `now` in `timeZone`.
public func todaySummary(
    _ todos: [Todo],
    now: Date = Date(),
    limit: Int = todayLimit,
    timeZone: TimeZone = .current
) -> TodaySummary {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let parts = calendar.dateComponents([.year, .month, .day], from: now)
    let today = String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    let open = todos.filter { !$0.completed }
    let dated = open.filter { todo in todo.dueDate.map { $0 <= today } ?? false }
    let undated = open.filter { $0.dueDate == nil }
    return TodaySummary(
        todos: Array((sortByPriority(dated) + sortByPriority(undated)).prefix(max(0, limit))),
        dueToday: dated.filter { $0.dueDate == today }.count,
        overdue: dated.filter { $0.dueDate != today }.count,
        remaining: open.count
    )
}

public func todaySubtitle(dueToday: Int, overdue: Int, remaining: Int) -> String {
    if remaining == 0 { return "All done" }
    let parts = overdue > 0 ? ["\(overdue) overdue"] : []
    return (parts + ["\(dueToday) due today"]).joined(separator: " · ")
}

public func todaySubtitle(_ summary: TodaySummary) -> String {
    todaySubtitle(dueToday: summary.dueToday, overdue: summary.overdue, remaining: summary.remaining)
}

public func todayMoreLabel(shown: Int, remaining: Int) -> String? {
    let hidden = remaining - shown
    return hidden > 0 ? "+\(hidden) more" : nil
}

public func todayMoreLabel(_ summary: TodaySummary) -> String? {
    todayMoreLabel(shown: summary.todos.count, remaining: summary.remaining)
}
