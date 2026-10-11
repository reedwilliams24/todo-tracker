public enum TodoPriority: String, Codable, CaseIterable, Sendable {
    case low, medium, high
}

public enum TodoFilter: String, Codable, CaseIterable, Sendable {
    case all, active, completed
}

/// Reminder offset from a todo's due date (spec/features/reminders.md).
public enum ReminderOffset: String, Codable, CaseIterable, Sendable {
    case at
    case hourBefore = "1h"
    case dayBefore = "1d"

    public var label: String {
        switch self {
        case .at: "When due"
        case .hourBefore: "1 hour before"
        case .dayBefore: "1 day before"
        }
    }
}

/// Repeat rule; see spec/features/recurrence.md.
public enum Recurrence: String, Codable, CaseIterable, Sendable {
    case daily, weekly, monthly

    public var label: String { rawValue.capitalized }
}

public enum TodoSort: String, Codable, CaseIterable, Sendable {
    case priority, due
}

public struct Todo: Codable, Equatable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var notes: String?
    public var completed: Bool
    public var priority: TodoPriority
    /// Calendar date `YYYY-MM-DD`, no time zone.
    public var dueDate: String?
    /// Only set when `dueDate` is set.
    public var reminder: ReminderOffset?
    public var recurrence: Recurrence?
    /// UTC ISO-8601 with milliseconds, e.g. `2026-01-05T09:00:00.000Z`.
    public var createdAt: String
    public var updatedAt: String
    /// When the todo was last completed; nil while open and for data from before REED-19.
    public var completedAt: String?

    public init(
        id: String,
        title: String,
        notes: String? = nil,
        completed: Bool = false,
        priority: TodoPriority = defaultPriority,
        dueDate: String? = nil,
        reminder: ReminderOffset? = nil,
        recurrence: Recurrence? = nil,
        createdAt: String,
        updatedAt: String,
        completedAt: String? = nil
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.completed = completed
        self.priority = priority
        self.dueDate = dueDate
        self.reminder = reminder
        self.recurrence = recurrence
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.completedAt = completedAt
    }
}

public struct TodoDraft: Codable, Equatable, Sendable {
    public var title: String
    public var notes: String?
    public var priority: TodoPriority?
    public var dueDate: String?
    public var reminder: ReminderOffset?
    public var recurrence: Recurrence?

    public init(
        title: String,
        notes: String? = nil,
        priority: TodoPriority? = nil,
        dueDate: String? = nil,
        reminder: ReminderOffset? = nil,
        recurrence: Recurrence? = nil
    ) {
        self.title = title
        self.notes = notes
        self.priority = priority
        self.dueDate = dueDate
        self.reminder = reminder
        self.recurrence = recurrence
    }
}
