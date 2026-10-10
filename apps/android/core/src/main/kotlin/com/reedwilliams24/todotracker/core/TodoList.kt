package com.reedwilliams24.todotracker.core

import java.time.Instant

data class AddResult(val todos: List<Todo>, val created: List<Todo>)

fun addTodos(todos: List<Todo>, drafts: List<TodoDraft>, now: Instant = Instant.now()): AddResult {
    val created = drafts.map { createTodo(it, now) }
    return AddResult(created + todos, created)
}

fun toggleInList(todos: List<Todo>, id: String, now: Instant = Instant.now()): List<Todo> =
    todos.map { if (it.id == id) toggleTodo(it, now) else it }

fun renameInList(todos: List<Todo>, id: String, title: String, now: Instant = Instant.now()): List<Todo> =
    updateTodoText(todos, id, title, now)

fun removeFromList(todos: List<Todo>, ids: Collection<String>): List<Todo> {
    val doomed = ids.toSet()
    return todos.filter { it.id !in doomed }
}

fun clearCompletedInList(todos: List<Todo>): List<Todo> = todos.filter { !it.completed }
