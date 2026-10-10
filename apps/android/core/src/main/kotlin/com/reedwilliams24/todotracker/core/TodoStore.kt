package com.reedwilliams24.todotracker.core

import java.time.Instant

data class TodoState(val todos: List<Todo> = emptyList(), val undoable: UndoEntry? = null)

sealed interface TodoAction {
    data class Load(val todos: List<Todo>) : TodoAction
    data class Prepend(val todos: List<Todo>) : TodoAction
    data class Toggle(val id: String) : TodoAction
    data class Rename(val id: String, val title: String) : TodoAction
    data class Remove(val ids: List<String>) : TodoAction
    data object ClearCompleted : TodoAction
    data object Undo : TodoAction
    data object ExpireUndo : TodoAction
}

/** Port of `reduceTodos` in packages/shared/src/store.ts. */
fun reduceTodos(state: TodoState, action: TodoAction, now: Instant = Instant.now()): TodoState {
    val todos = state.todos
    fun snapshot(label: String) = UndoEntry(label, todos, now.toEpochMilli())

    return when (action) {
        is TodoAction.Load -> state.copy(todos = action.todos)
        is TodoAction.Prepend -> state.copy(todos = action.todos + todos)
        is TodoAction.Toggle -> {
            val target = todos.firstOrNull { it.id == action.id }
            val undoable = if (target != null && !target.completed) snapshot(describeUndo(UndoKind.COMPLETE, 1)) else state.undoable
            TodoState(toggleInList(todos, action.id, now), undoable)
        }
        is TodoAction.Rename -> state.copy(todos = renameInList(todos, action.id, action.title, now))
        is TodoAction.Remove -> {
            val next = removeFromList(todos, action.ids)
            if (next.size == todos.size) state else TodoState(next, snapshot(describeUndo(UndoKind.DELETE, action.ids.size)))
        }
        TodoAction.ClearCompleted -> {
            val next = clearCompletedInList(todos)
            val removed = todos.size - next.size
            if (removed == 0) state else TodoState(next, snapshot(describeUndo(UndoKind.DELETE, removed)))
        }
        TodoAction.Undo -> state.undoable?.let { TodoState(it.before.toList(), null) } ?: state
        TodoAction.ExpireUndo ->
            if (state.undoable != null && isUndoExpired(state.undoable, now.toEpochMilli())) state.copy(undoable = null) else state
    }
}
