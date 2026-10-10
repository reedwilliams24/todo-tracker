import Foundation

public let defaultPriority: TodoPriority = .medium

/// Controlled-input state for the add-todo form; `dueDate` is "" when unset.
public struct TodoFormState: Codable, Equatable, Sendable {
    public var title: String
    public var priority: TodoPriority
    public var dueDate: String

    public init(title: String = "", priority: TodoPriority = defaultPriority, dueDate: String = "") {
        self.title = title
        self.priority = priority
        self.dueDate = dueDate
    }

    public static let empty = TodoFormState()
}

public func toTodoDraft(_ form: TodoFormState) -> TodoDraft {
    TodoDraft(title: form.title, priority: form.priority, dueDate: form.dueDate.isEmpty ? nil : form.dueDate)
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

public func toggleTodo(_ todo: Todo, now: Date = Date()) -> Todo {
    var next = todo
    next.completed.toggle()
    next.updatedAt = Timestamp.iso(now)
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

/// Priority high→low, then due date (undated last), then creation; completed sink.
///
/// The TS comparator returns 1 (never 0) for equal `createdAt`, which V8's stable TimSort
/// treats like a tie. A stable sort with ties kept in input order gives the same result.
public func sortByPriority(_ todos: [Todo]) -> [Todo] {
    todos.enumerated()
        .sorted { lhs, rhs in
            let order = compareForDisplay(lhs.element, rhs.element)
            return order != 0 ? order < 0 : lhs.offset < rhs.offset
        }
        .map(\.element)
}

private func compareForDisplay(_ a: Todo, _ b: Todo) -> Int {
    if a.completed != b.completed { return a.completed ? 1 : -1 }
    let byPriority = a.priority.order - b.priority.order
    if byPriority != 0 { return byPriority }
    if a.dueDate != b.dueDate {
        guard let left = a.dueDate else { return 1 }
        guard let right = b.dueDate else { return -1 }
        return left < right ? -1 : 1
    }
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
