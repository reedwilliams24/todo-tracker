import Foundation

/// Port of apps/web/src/domain/subtasks.ts (spec/features/subtasks.md).
public struct SubtaskProgress: Codable, Equatable, Sendable {
    public var done: Int
    public var total: Int

    public var label: String { "\(done)/\(total)" }
}

public func subtaskProgress(_ todo: Todo) -> SubtaskProgress {
    let subtasks = todo.subtasks ?? []
    return SubtaskProgress(done: subtasks.filter(\.completed).count, total: subtasks.count)
}

public func addSubtask(_ todo: Todo, title: String, now: Date = Date()) -> Todo {
    guard isValidTitle(title) else { return todo }
    var next = todo
    next.subtasks = (todo.subtasks ?? []) + [Subtask(id: generateId(), title: title.jsTrimmed)]
    next.updatedAt = Timestamp.iso(now)
    return next
}

/// Completes the parent when every subtask is done; un-checking one reopens it. `completedAt` follows,
/// as in `toggleTodo`.
public func toggleSubtask(_ todo: Todo, subtaskId: String, now: Date = Date()) -> Todo {
    guard var subtasks = todo.subtasks, let index = subtasks.firstIndex(where: { $0.id == subtaskId }) else {
        return todo
    }
    subtasks[index].completed.toggle()
    var next = todo
    next.subtasks = subtasks
    next.completed = subtasks.allSatisfy(\.completed)
    next.updatedAt = Timestamp.iso(now)
    if next.completed != todo.completed {
        next.completedAt = next.completed ? next.updatedAt : nil
    }
    return next
}

public func removeSubtask(_ todo: Todo, subtaskId: String, now: Date = Date()) -> Todo {
    guard let current = todo.subtasks, current.contains(where: { $0.id == subtaskId }) else { return todo }
    let subtasks = current.filter { $0.id != subtaskId }
    var next = todo
    next.subtasks = subtasks.isEmpty ? nil : subtasks
    next.updatedAt = Timestamp.iso(now)
    return next
}

/// Toggles a subtask in the list; completing a recurring parent inserts its next occurrence right after it.
public func toggleSubtaskInList(_ todos: [Todo], id: String, subtaskId: String, now: Date = Date()) -> [Todo] {
    todos.flatMap { todo -> [Todo] in
        guard todo.id == id else { return [todo] }
        let toggled = toggleSubtask(todo, subtaskId: subtaskId, now: now)
        guard toggled.completed, !todo.completed, let next = scheduleNext(toggled, now: now) else { return [toggled] }
        return [toggled, next]
    }
}
