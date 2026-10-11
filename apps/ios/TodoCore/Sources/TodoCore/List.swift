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

public func updateInList(_ todos: [Todo], id: String, _ update: (Todo) -> Todo) -> [Todo] {
    todos.map { $0.id == id ? update($0) : $0 }
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

/// Moves the todo at `fromIndex` to `toIndex`; out-of-range or equal indexes change nothing.
public func reorderTodos(_ todos: [Todo], fromIndex: Int, toIndex: Int) -> [Todo] {
    var next = todos
    guard fromIndex != toIndex, next.indices.contains(fromIndex), next.indices.contains(toIndex) else { return next }
    next.insert(next.remove(at: fromIndex), at: toIndex)
    return next
}

/// Moves `id` into `targetId`'s slot within the displayed rows (`visibleIds`, in display order) and
/// writes that order back into the slots the visible todos occupy; hidden todos stay put.
public func moveVisibleTodo(_ todos: [Todo], visibleIds: [String], id: String, targetId: String) -> [Todo] {
    guard let from = visibleIds.firstIndex(of: id), let to = visibleIds.firstIndex(of: targetId), from != to else {
        return todos
    }
    let byId = Dictionary(todos.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    var ordered = reorderTodos(visibleIds.compactMap { byId[$0] }, fromIndex: from, toIndex: to).makeIterator()
    let visible = Set(visibleIds)
    return todos.map { visible.contains($0.id) ? ordered.next()! : $0 }
}
