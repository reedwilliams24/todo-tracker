import Foundation

public let statsDays = 30

public struct DayCount: Codable, Equatable, Sendable {
    /// Calendar date `YYYY-MM-DD`.
    public var date: String
    public var count: Int
}

public struct TodoStats: Codable, Equatable, Sendable {
    /// Oldest first, exactly `days` entries ending today.
    public var perDay: [DayCount]
    public var totalCompleted: Int
    public var currentStreak: Int
    public var longestStreak: Int
}

private func gregorian(_ timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
}

/// Calendar date `YYYY-MM-DD` of an instant in `timeZone`.
public func localDateKey(_ date: Date, timeZone: TimeZone = .current) -> String {
    let parts = gregorian(timeZone).dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
}

/// Adds whole calendar days to a `YYYY-MM-DD` key. Pure date math, so DST never skips or repeats a day.
public func addDays(toKey key: String, _ days: Int) -> String {
    let utc = gregorian(TimeZone(identifier: "UTC")!)
    let numbers = key.split(separator: "-").compactMap { Int($0) }
    let date = utc.date(from: DateComponents(year: numbers[0], month: numbers[1], day: numbers[2] + days))!
    return localDateKey(date, timeZone: utc.timeZone)
}

/// Completions per calendar day, for completed todos with a valid `completedAt`.
public func completionsByDay(_ todos: [Todo], timeZone: TimeZone = .current) -> [String: Int] {
    var counts: [String: Int] = [:]
    for todo in todos where todo.completed {
        guard let raw = todo.completedAt, let at = Timestamp.parse(raw) else { continue }
        counts[localDateKey(at, timeZone: timeZone), default: 0] += 1
    }
    return counts
}

/// Consecutive days with a completion, ending today or yesterday (today doesn't break a streak until it's over).
public func currentStreak(_ counts: [String: Int], today: String) -> Int {
    var cursor = counts[today] != nil ? today : addDays(toKey: today, -1)
    var streak = 0
    while counts[cursor] != nil {
        streak += 1
        cursor = addDays(toKey: cursor, -1)
    }
    return streak
}

public func longestStreak(_ counts: [String: Int]) -> Int {
    var best = 0
    var run = 0
    var previous: String?
    for key in counts.keys.sorted() {
        run = previous.map { addDays(toKey: $0, 1) == key } == true ? run + 1 : 1
        best = max(best, run)
        previous = key
    }
    return best
}

public func computeStats(
    _ todos: [Todo],
    now: Date = Date(),
    days: Int = statsDays,
    timeZone: TimeZone = .current
) -> TodoStats {
    let counts = completionsByDay(todos, timeZone: timeZone)
    let today = localDateKey(now, timeZone: timeZone)
    return TodoStats(
        perDay: (0..<days).reversed().map { offset in
            let date = addDays(toKey: today, -offset)
            return DayCount(date: date, count: counts[date] ?? 0)
        },
        totalCompleted: counts.values.reduce(0, +),
        currentStreak: currentStreak(counts, today: today),
        longestStreak: longestStreak(counts)
    )
}
