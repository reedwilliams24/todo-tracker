import Foundation

/// Date-only due dates are treated as due at this local hour.
public let dueHour = 9

public let reminderTitle = "Todo Tracker"

public let reminderOffsets = ReminderOffset.allCases

/// A planned notification. `key` is `<todoId>:<dueDate>:<offset>`.
public struct Reminder: Equatable, Sendable {
    public let key: String
    public let todoId: String
    public let title: String
    public let body: String
    public let at: Date
}

/// 09:00 local on the due date (`at`), 08:00 (`1h`), or 09:00 the day before (`1d`).
public func reminderAt(_ todo: Todo, calendar: Calendar = .current) -> Date? {
    guard let offset = todo.reminder, let due = todo.dueDate, isValidDueDate(due), !due.isEmpty else { return nil }
    let parts = due.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    var components = DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: dueHour, minute: 0, second: 0)
    switch offset {
    case .at: break
    case .hourBefore: components.hour = dueHour - 1
    case .dayBefore: components.day = parts[2] - 1
    }
    return calendar.date(from: components)
}

public func describeReminder(_ todo: Todo) -> String {
    switch todo.reminder {
    case nil: ""
    case .at: "Due today: \(todo.title)"
    case .hourBefore: "Due in 1 hour: \(todo.title)"
    case .dayBefore: "Due tomorrow: \(todo.title)"
    }
}

/// One reminder per open todo with a due date and a reminder offset, in list order.
public func planReminders(_ todos: [Todo], calendar: Calendar = .current) -> [Reminder] {
    todos.compactMap { todo in
        guard !todo.completed, let offset = todo.reminder, let due = todo.dueDate,
              let at = reminderAt(todo, calendar: calendar) else { return nil }
        return Reminder(
            key: "\(todo.id):\(due):\(offset.rawValue)",
            todoId: todo.id,
            title: reminderTitle,
            body: describeReminder(todo),
            at: at
        )
    }
}

/// Planned reminders whose time is at or before `now` and that have not been delivered.
public func dueReminders(_ todos: [Todo], delivered: Set<String>, now: Date, calendar: Calendar = .current) -> [Reminder] {
    planReminders(todos, calendar: calendar).filter { $0.at <= now && !delivered.contains($0.key) }
}

/// Delivered keys that still match a planned reminder.
public func pruneDelivered(_ delivered: Set<String>, todos: [Todo]) -> Set<String> {
    delivered.intersection(planReminders(todos).map(\.key))
}
