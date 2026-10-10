import Foundation

/// In-memory todo list state; persistence and timers live in the app layer.
public struct TodoState: Equatable, Sendable {
    public var todos: [Todo]
    public var undoable: UndoEntry?

    public init(todos: [Todo] = [], undoable: UndoEntry? = nil) {
        self.todos = todos
        self.undoable = undoable
    }

    public static let initial = TodoState()
}

public enum TodoAction: Equatable, Sendable {
    case load([Todo])
    case prepend([Todo])
    case toggle(id: String)
    case rename(id: String, title: String)
    case remove(ids: [String])
    case clearCompleted
    case undo
    case expireUndo
}

/// Pure state transition for the todo list, including the undo snapshot.
public func reduceTodos(_ state: TodoState, _ action: TodoAction, now: Date = Date()) -> TodoState {
    let todos = state.todos
    let nowMs = Timestamp.milliseconds(now)
    func snapshot(_ label: String) -> UndoEntry { UndoEntry(label: label, before: todos, at: nowMs) }

    switch action {
    case .load(let loaded):
        return TodoState(todos: loaded, undoable: state.undoable)
    case .prepend(let added):
        return TodoState(todos: added + todos, undoable: state.undoable)
    case .toggle(let id):
        let target = todos.first { $0.id == id }
        let undoable = target.map { !$0.completed } == true
            ? snapshot(describeUndo(.complete, count: 1))
            : state.undoable
        return TodoState(todos: toggleInList(todos, id: id, now: now), undoable: undoable)
    case .rename(let id, let title):
        return TodoState(todos: renameInList(todos, id: id, title: title, now: now), undoable: state.undoable)
    case .remove(let ids):
        let next = removeFromList(todos, ids: ids)
        if next.count == todos.count { return state }
        return TodoState(todos: next, undoable: snapshot(describeUndo(.delete, count: ids.count)))
    case .clearCompleted:
        let next = clearCompletedInList(todos)
        let removed = todos.count - next.count
        if removed == 0 { return state }
        return TodoState(todos: next, undoable: snapshot(describeUndo(.delete, count: removed)))
    case .undo:
        guard let entry = state.undoable else { return state }
        return TodoState(todos: entry.before, undoable: nil)
    case .expireUndo:
        guard let entry = state.undoable, isUndoExpired(entry, now: nowMs) else { return state }
        return TodoState(todos: todos, undoable: nil)
    }
}
