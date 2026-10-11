package com.reedwilliams24.todotracker.core

import java.time.Instant

/** Port of apps/web/src/domain/subtasks.ts (spec/features/subtasks.md). */
data class SubtaskProgress(val done: Int, val total: Int) {
    val label: String
        get() = "$done/$total"
}

fun subtaskProgress(todo: Todo): SubtaskProgress {
    val subtasks = todo.subtasks.orEmpty()
    return SubtaskProgress(subtasks.count { it.completed }, subtasks.size)
}

fun addSubtask(todo: Todo, title: String, now: Instant = Instant.now()): Todo {
    if (!isValidTitle(title)) return todo
    val subtask = Subtask(id = generateId(), title = title.trim(), completed = false)
    return todo.copy(subtasks = todo.subtasks.orEmpty() + subtask, updatedAt = timestamp(now))
}

/**
 * Completes the parent when every subtask is done; un-checking one reopens it. `completedAt` follows, as in
 * `toggleTodo`.
 */
fun toggleSubtask(todo: Todo, subtaskId: String, now: Instant = Instant.now()): Todo {
    val current = todo.subtasks ?: return todo
    if (current.none { it.id == subtaskId }) return todo
    val subtasks = current.map { if (it.id == subtaskId) it.copy(completed = !it.completed) else it }
    val completed = subtasks.all { it.completed }
    if (completed == todo.completed) return todo.copy(subtasks = subtasks, updatedAt = timestamp(now))
    return todo.copy(
        subtasks = subtasks,
        completed = completed,
        updatedAt = timestamp(now),
        completedAt = if (completed) timestamp(now) else null,
    )
}

/** Toggles a subtask in the list; completing a recurring parent inserts its next occurrence right after it. */
fun toggleSubtaskInList(todos: List<Todo>, id: String, subtaskId: String, now: Instant = Instant.now()): List<Todo> =
    todos.flatMap {
        if (it.id != id) return@flatMap listOf(it)
        val toggled = toggleSubtask(it, subtaskId, now)
        val next = if (toggled.completed && !it.completed) scheduleNext(toggled, now) else null
        listOfNotNull(toggled, next)
    }

fun removeSubtask(todo: Todo, subtaskId: String, now: Instant = Instant.now()): Todo {
    val current = todo.subtasks ?: return todo
    if (current.none { it.id == subtaskId }) return todo
    val subtasks = current.filter { it.id != subtaskId }
    return todo.copy(subtasks = subtasks.ifEmpty { null }, updatedAt = timestamp(now))
}
