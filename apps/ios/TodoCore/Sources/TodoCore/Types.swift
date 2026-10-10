public enum TodoPriority: String, Codable, CaseIterable, Sendable {
    case low, medium, high
}

public enum TodoFilter: String, Codable, CaseIterable, Sendable {
    case all, active, completed
}

public struct Todo: Codable, Equatable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var notes: String?
    public var completed: Bool
    public var priority: TodoPriority
    /// Calendar date `YYYY-MM-DD`, no time zone.
    public var dueDate: String?
    /// UTC ISO-8601 with milliseconds, e.g. `2026-01-05T09:00:00.000Z`.
    public var createdAt: String
    public var updatedAt: String

    public init(
        id: String,
        title: String,
        notes: String? = nil,
        completed: Bool = false,
        priority: TodoPriority = defaultPriority,
        dueDate: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.completed = completed
        self.priority = priority
        self.dueDate = dueDate
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct TodoDraft: Codable, Equatable, Sendable {
    public var title: String
    public var notes: String?
    public var priority: TodoPriority?
    public var dueDate: String?

    public init(title: String, notes: String? = nil, priority: TodoPriority? = nil, dueDate: String? = nil) {
        self.title = title
        self.notes = notes
        self.priority = priority
        self.dueDate = dueDate
    }
}
