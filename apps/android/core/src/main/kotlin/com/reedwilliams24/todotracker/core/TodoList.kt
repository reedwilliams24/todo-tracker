package com.reedwilliams24.todotracker.core

import java.time.Instant

data class AddResult(val todos: List<Todo>, val created: List<Todo>)

fun addTodos(todos: List<Todo>, drafts: List<TodoDraft>, now: Instant = Instant.now()): AddResult {
    val created = drafts.map { createTodo(it, now) }
    return AddResult(created + todos, created)
}

/** Toggles a todo; completing a recurring todo inserts its next occurrence right after it. */
fun toggleInList(todos: List<Todo>, id: String, now: Instant = Instant.now()): List<Todo> =
    todos.flatMap {
        if (it.id != id) return@flatMap listOf(it)
        val toggled = toggleTodo(it, now)
        val next = if (toggled.completed) scheduleNext(toggled, now) else null
        listOfNotNull(toggled, next)
    }

fun renameInList(todos: List<Todo>, id: String, title: String, now: Instant = Instant.now()): List<Todo> =
    updateTodoText(todos, id, title, now)

fun removeFromList(todos: List<Todo>, ids: Collection<String>): List<Todo> {
    val doomed = ids.toSet()
    return todos.filter { it.id !in doomed }
}

fun clearCompletedInList(todos: List<Todo>): List<Todo> = todos.filter { !it.completed }

fun countCompleted(todos: List<Todo>): Int = todos.count { it.completed }

/** Completes every todo in [ids], or reopens them all when every selected todo is already complete. */
fun bulkToggle(todos: List<Todo>, ids: Collection<String>, now: Instant = Instant.now()): List<Todo> {
    val chosen = ids.toSet()
    val selected = todos.filter { it.id in chosen }
    if (selected.isEmpty()) return todos
    val complete = selected.any { !it.completed }
    return todos.map { if (it.id in chosen && it.completed != complete) toggleTodo(it, now) else it }
}

/** Moves the todo at `fromIndex` to `toIndex`; out-of-range or equal indexes change nothing. */
fun reorderTodos(todos: List<Todo>, fromIndex: Int, toIndex: Int): List<Todo> {
    val next = todos.toMutableList()
    if (fromIndex == toIndex || fromIndex !in next.indices || toIndex !in next.indices) return next
    next.add(toIndex, next.removeAt(fromIndex))
    return next
}

/**
 * Moves `id` into `targetId`'s slot within the displayed rows (`visibleIds`, in display order) and writes that order
 * back into the slots the visible todos occupy; hidden todos stay put.
 */
fun moveVisibleTodo(todos: List<Todo>, visibleIds: List<String>, id: String, targetId: String): List<Todo> {
    val from = visibleIds.indexOf(id)
    val to = visibleIds.indexOf(targetId)
    if (from == -1 || to == -1 || from == to) return todos.toList()
    val byId = todos.associateBy { it.id }
    val ordered = reorderTodos(visibleIds.mapNotNull { byId[it] }, from, to).iterator()
    val visible = visibleIds.toSet()
    return todos.map { if (it.id in visible) ordered.next() else it }
}
