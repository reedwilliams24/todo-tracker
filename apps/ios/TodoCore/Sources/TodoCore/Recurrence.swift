import Foundation

private let utcCalendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    return calendar
}()

/// Next due date on calendar days; monthly clamps to the last day of a shorter month.
public func nextOccurrence(_ dueDate: String, _ recurrence: Recurrence) -> String {
    let parts = dueDate.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3,
        let date = utcCalendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    else { return dueDate }
    let next: Date?
    switch recurrence {
    case .daily: next = utcCalendar.date(byAdding: .day, value: 1, to: date)
    case .weekly: next = utcCalendar.date(byAdding: .day, value: 7, to: date)
    case .monthly: next = utcCalendar.date(byAdding: .month, value: 1, to: date)
    }
    guard let next else { return dueDate }
    let c = utcCalendar.dateComponents([.year, .month, .day], from: next)
    return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
}

/// The todo that replaces a completed recurring one, or nil if it doesn't repeat.
public func scheduleNext(_ todo: Todo, now: Date = Date()) -> Todo? {
    guard let recurrence = todo.recurrence else { return nil }
    let base = todo.dueDate ?? String(Timestamp.iso(now).prefix(10))
    return createTodo(
        TodoDraft(
            title: todo.title,
            notes: todo.notes,
            priority: todo.priority,
            dueDate: nextOccurrence(base, recurrence),
            recurrence: recurrence
        ),
        now: now
    )
}
