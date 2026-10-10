import Foundation

public struct AddTodosResult: Codable, Equatable, Sendable {
    public var todos: [Todo]
    public var created: [Todo]
}

/// New todos are prepended in draft order.
public func addTodos(_ todos: [Todo], drafts: [TodoDraft], now: Date = Date()) -> AddTodosResult {
    let created = drafts.map { createTodo($0, now: now) }
    return AddTodosResult(todos: created + todos, created: created)
}

public func toggleInList(_ todos: [Todo], id: String, now: Date = Date()) -> [Todo] {
    todos.map { $0.id == id ? toggleTodo($0, now: now) : $0 }
}

public func renameInList(_ todos: [Todo], id: String, title: String, now: Date = Date()) -> [Todo] {
    updateTodoText(todos, id: id, text: title, now: now)
}

public func removeFromList(_ todos: [Todo], ids: [String]) -> [Todo] {
    let doomed = Set(ids)
    return todos.filter { !doomed.contains($0.id) }
}

public func clearCompletedInList(_ todos: [Todo]) -> [Todo] {
    todos.filter { !$0.completed }
}
