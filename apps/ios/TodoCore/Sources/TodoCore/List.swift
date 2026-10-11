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

/// Toggles a todo; completing a recurring todo inserts its next occurrence right after it.
public func toggleInList(_ todos: [Todo], id: String, now: Date = Date()) -> [Todo] {
    todos.flatMap { todo -> [Todo] in
        guard todo.id == id else { return [todo] }
        let toggled = toggleTodo(todo, now: now)
        guard toggled.completed, let next = scheduleNext(toggled, now: now) else { return [toggled] }
        return [toggled, next]
    }
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

public func countCompleted(_ todos: [Todo]) -> Int {
    todos.filter(\.completed).count
}

/// Completes every todo in `ids`, or reopens them all when every selected todo is already complete.
public func bulkToggle(_ todos: [Todo], ids: [String], now: Date = Date()) -> [Todo] {
    let chosen = Set(ids)
    let selected = todos.filter { chosen.contains($0.id) }
    if selected.isEmpty { return todos }
    let complete = selected.contains { !$0.completed }
    return todos.map { chosen.contains($0.id) && $0.completed != complete ? toggleTodo($0, now: now) : $0 }
}
