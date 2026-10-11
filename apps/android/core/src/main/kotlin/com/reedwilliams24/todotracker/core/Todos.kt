package com.reedwilliams24.todotracker.core

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.ResolverStyle
import java.time.temporal.ChronoUnit
import java.util.UUID

val DEFAULT_PRIORITY = TodoPriority.MEDIUM

val EMPTY_TODO_FORM = TodoFormState()

val PRIORITY_ORDER: Map<TodoPriority, Int> =
    mapOf(TodoPriority.HIGH to 0, TodoPriority.MEDIUM to 1, TodoPriority.LOW to 2)

private val ISO_DATE = Regex("""^\d{4}-\d{2}-\d{2}$""")
private val STRICT_DATE = DateTimeFormatter.ofPattern("uuuu-MM-dd").withResolverStyle(ResolverStyle.STRICT)
private val DATE_KEY = DateTimeFormatter.ofPattern("uuuu-MM-dd")
private val TIMESTAMP = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC)

fun toTodoDraft(form: TodoFormState): TodoDraft =
    TodoDraft(
        title = form.title,
        priority = form.priority,
        dueDate = form.dueDate.ifEmpty { null },
        reminder = if (form.dueDate.isEmpty()) null else ReminderOffset.fromKey(form.reminder),
        recurrence = Recurrence.fromKey(form.recurrence),
    )

/** Accepts an empty value or a real calendar date in YYYY-MM-DD form. */
fun isValidDueDate(value: String?): Boolean {
    if (value.isNullOrEmpty()) return true
    if (!ISO_DATE.matches(value)) return false
    return try {
        LocalDate.parse(value, STRICT_DATE)
        true
    } catch (_: DateTimeParseException) {
        false
    }
}

fun isValidTitle(title: String): Boolean = title.trim().length in 1..200

fun generateId(): String = UUID.randomUUID().toString()

/** UTC ISO-8601 with milliseconds, like JS `Date.toISOString()`. */
fun timestamp(now: Instant): String = TIMESTAMP.format(now.truncatedTo(ChronoUnit.MILLIS))

fun createTodo(draft: TodoDraft, now: Instant = Instant.now()): Todo {
    val stamp = timestamp(now)
    return Todo(
        id = generateId(),
        title = draft.title.trim(),
        notes = draft.notes?.trim()?.ifEmpty { null },
        completed = false,
        priority = draft.priority ?: DEFAULT_PRIORITY,
        dueDate = draft.dueDate,
        reminder = if (draft.dueDate.isNullOrEmpty()) null else draft.reminder,
        recurrence = draft.recurrence,
        createdAt = stamp,
        updatedAt = stamp,
    )
}

fun updateTodoText(todos: List<Todo>, id: String, text: String, now: Instant = Instant.now()): List<Todo> {
    if (!isValidTitle(text)) return todos.toList()
    val title = text.trim()
    return todos.map {
        if (it.id == id && it.title != title) it.copy(title = title, updatedAt = timestamp(now)) else it
    }
}

/** Completing sets `completedAt`; reopening clears it. */
fun toggleTodo(todo: Todo, now: Instant = Instant.now()): Todo {
    val completed = !todo.completed
    return todo.copy(
        completed = completed,
        updatedAt = timestamp(now),
        completedAt = if (completed) timestamp(now) else null,
    )
}

fun filterTodos(todos: List<Todo>, filter: TodoFilter): List<Todo> =
    when (filter) {
        TodoFilter.ACTIVE -> todos.filter { !it.completed }
        TodoFilter.COMPLETED -> todos.filter { it.completed }
        TodoFilter.ALL -> todos.toList()
    }

fun searchTodos(todos: List<Todo>, query: String): List<Todo> {
    val needle = query.trim().lowercase()
    if (needle.isEmpty()) return todos.toList()
    return todos.filter { it.title.lowercase().contains(needle) || (it.notes?.lowercase()?.contains(needle) ?: false) }
}

/** Local calendar date of `now` in YYYY-MM-DD form, matching how dueDate is stored. */
fun toDateKey(now: LocalDateTime): String = DATE_KEY.format(now)

/** True for an incomplete todo whose due date is before today (local time). */
fun isOverdue(todo: Todo, now: LocalDateTime = LocalDateTime.now()): Boolean =
    !todo.completed && !todo.dueDate.isNullOrEmpty() && todo.dueDate < toDateKey(now)

private fun compareDue(a: Todo, b: Todo): Int {
    if (a.dueDate == b.dueDate) return 0
    if (a.dueDate.isNullOrEmpty()) return 1
    if (b.dueDate.isNullOrEmpty()) return -1
    return if (a.dueDate < b.dueDate) -1 else 1
}

private fun comparePriority(a: Todo, b: Todo): Int =
    PRIORITY_ORDER.getValue(a.priority) - PRIORITY_ORDER.getValue(b.priority)

/** Mirrors the TS comparators exactly, including never returning 0 for ties. */
private fun compareCreated(a: Todo, b: Todo): Int = if (a.createdAt < b.createdAt) -1 else 1

/** Priority high→low, then due date (undated last), then creation; completed sink. */
private fun compareByPriority(a: Todo, b: Todo): Int {
    if (a.completed != b.completed) return if (a.completed) 1 else -1
    comparePriority(a, b).let { if (it != 0) return it }
    compareDue(a, b).let { if (it != 0) return it }
    return compareCreated(a, b)
}

/** Due date ascending (undated last), then priority, then creation; completed sink. */
private fun compareByDue(a: Todo, b: Todo): Int {
    if (a.completed != b.completed) return if (a.completed) 1 else -1
    compareDue(a, b).let { if (it != 0) return it }
    comparePriority(a, b).let { if (it != 0) return it }
    return compareCreated(a, b)
}

fun sortByPriority(todos: List<Todo>): List<Todo> = todos.sortedWith(::compareByPriority)

fun sortByDue(todos: List<Todo>): List<Todo> = todos.sortedWith(::compareByDue)

fun sortTodos(todos: List<Todo>, sort: TodoSort = TodoSort.PRIORITY): List<Todo> =
    when (sort) {
        TodoSort.DUE -> sortByDue(todos)
        TodoSort.MANUAL -> todos.toList()
        TodoSort.PRIORITY -> sortByPriority(todos)
    }

fun countRemaining(todos: List<Todo>): Int = todos.count { !it.completed }

fun remainingLabel(remaining: Int): String = "$remaining ${if (remaining == 1) "task" else "tasks"} remaining"
