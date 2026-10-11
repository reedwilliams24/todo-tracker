import Foundation

public let defaultPriority: TodoPriority = .medium

/// Controlled-input state for the add-todo form; `dueDate` and `recurrence` are "" when unset.
public struct TodoFormState: Codable, Equatable, Sendable {
    public var title: String
    public var priority: TodoPriority
    public var dueDate: String
    public var recurrence: String

    public init(title: String = "", priority: TodoPriority = defaultPriority, dueDate: String = "", recurrence: String = "") {
        self.title = title
        self.priority = priority
        self.dueDate = dueDate
        self.recurrence = recurrence
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decode(String.self, forKey: .title)
        priority = try c.decode(TodoPriority.self, forKey: .priority)
        dueDate = try c.decode(String.self, forKey: .dueDate)
        recurrence = try c.decodeIfPresent(String.self, forKey: .recurrence) ?? ""
    }

    public static let empty = TodoFormState()
}

public func toTodoDraft(_ form: TodoFormState) -> TodoDraft {
    TodoDraft(
        title: form.title,
        priority: form.priority,
        dueDate: form.dueDate.isEmpty ? nil : form.dueDate,
        recurrence: Recurrence(rawValue: form.recurrence)
    )
}

extension TodoPriority {
    /// Sort rank: high 0, medium 1, low 2.
    public var order: Int {
        switch self {
        case .high: 0
        case .medium: 1
        case .low: 2
        }
    }
}

private let dueDatePattern = JSRegex(#"^\d{4}-\d{2}-\d{2}$"#)

/// Accepts an empty value or a real calendar date in YYYY-MM-DD form.
public func isValidDueDate(_ value: String?) -> Bool {
    guard let value, !value.isEmpty else { return true }
    guard dueDatePattern.test(value) else { return false }
    let parts = value.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return false }
    let (year, month, day) = (parts[0], parts[1], parts[2])
    guard (1...12).contains(month) else { return false }
    let isLeap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
    let days = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return (1...days).contains(day)
}

public func generateId() -> String {
    UUID().uuidString.lowercased()
}

public func createTodo(_ draft: TodoDraft, now: Date = Date()) -> Todo {
    let timestamp = Timestamp.iso(now)
    let notes = draft.notes?.jsTrimmed
    return Todo(
        id: generateId(),
        title: draft.title.jsTrimmed,
        notes: notes?.isEmpty == false ? notes : nil,
        completed: false,
        priority: draft.priority ?? defaultPriority,
        dueDate: draft.dueDate,
        recurrence: draft.recurrence,
        createdAt: timestamp,
        updatedAt: timestamp
    )
}

public func updateTodoText(_ todos: [Todo], id: String, text: String, now: Date = Date()) -> [Todo] {
    guard isValidTitle(text) else { return todos }
    let title = text.jsTrimmed
    return todos.map { todo in
        guard todo.id == id, todo.title != title else { return todo }
        var next = todo
        next.title = title
        next.updatedAt = Timestamp.iso(now)
        return next
    }
}

/// Completing sets `completedAt`; reopening clears it.
public func toggleTodo(_ todo: Todo, now: Date = Date()) -> Todo {
    var next = todo
    next.completed.toggle()
    next.updatedAt = Timestamp.iso(now)
    next.completedAt = next.completed ? next.updatedAt : nil
    return next
}

public func filterTodos(_ todos: [Todo], _ filter: TodoFilter) -> [Todo] {
    switch filter {
    case .active: todos.filter { !$0.completed }
    case .completed: todos.filter { $0.completed }
    case .all: todos
    }
}

public func searchTodos(_ todos: [Todo], query: String) -> [Todo] {
    let needle = query.jsTrimmed.lowercased()
    guard !needle.isEmpty else { return todos }
    return todos.filter { todo in
        todo.title.lowercased().contains(needle) || (todo.notes?.lowercased().contains(needle) ?? false)
    }
}

/// Local calendar date of `now` in YYYY-MM-DD form, matching how `dueDate` is stored.
public func toDateKey(_ now: Date, timeZone: TimeZone = .current) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let parts = calendar.dateComponents([.year, .month, .day], from: now)
    return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
}

/// True for an incomplete todo whose due date is before today (local time).
public func isOverdue(_ todo: Todo, now: Date = Date()) -> Bool {
    guard !todo.completed, let dueDate = todo.dueDate, !dueDate.isEmpty else { return false }
    return dueDate < toDateKey(now)
}

/// Priority high→low, then due date (undated last), then creation; completed sink.
public func sortByPriority(_ todos: [Todo]) -> [Todo] {
    stableSorted(todos) { a, b in
        if a.completed != b.completed { return a.completed ? 1 : -1 }
        let byPriority = a.priority.order - b.priority.order
        if byPriority != 0 { return byPriority }
        let byDue = compareDue(a, b)
        if byDue != 0 { return byDue }
        return compareCreated(a, b)
    }
}

/// Due date ascending (undated last), then priority, then creation; completed sink.
public func sortByDue(_ todos: [Todo]) -> [Todo] {
    stableSorted(todos) { a, b in
        if a.completed != b.completed { return a.completed ? 1 : -1 }
        let byDue = compareDue(a, b)
        if byDue != 0 { return byDue }
        let byPriority = a.priority.order - b.priority.order
        if byPriority != 0 { return byPriority }
        return compareCreated(a, b)
    }
}

public func sortTodos(_ todos: [Todo], _ sort: TodoSort = .priority) -> [Todo] {
    switch sort {
    case .priority: sortByPriority(todos)
    case .due: sortByDue(todos)
    }
}

/// The TS comparators return 1 (never 0) for equal `createdAt`, which V8's stable TimSort
/// treats like a tie. A stable sort with ties kept in input order gives the same result.
private func stableSorted(_ todos: [Todo], by compare: (Todo, Todo) -> Int) -> [Todo] {
    todos.enumerated()
        .sorted { lhs, rhs in
            let order = compare(lhs.element, rhs.element)
            return order != 0 ? order < 0 : lhs.offset < rhs.offset
        }
        .map(\.element)
}

private func compareDue(_ a: Todo, _ b: Todo) -> Int {
    if a.dueDate == b.dueDate { return 0 }
    guard let left = a.dueDate, !left.isEmpty else { return 1 }
    guard let right = b.dueDate, !right.isEmpty else { return -1 }
    return left < right ? -1 : 1
}

private func compareCreated(_ a: Todo, _ b: Todo) -> Int {
    if a.createdAt == b.createdAt { return 0 }
    return a.createdAt < b.createdAt ? -1 : 1
}

public func countRemaining(_ todos: [Todo]) -> Int {
    todos.reduce(0) { $1.completed ? $0 : $0 + 1 }
}

public func isValidTitle(_ title: String) -> Bool {
    let length = title.jsTrimmed.jsLength
    return length > 0 && length <= 200
}
