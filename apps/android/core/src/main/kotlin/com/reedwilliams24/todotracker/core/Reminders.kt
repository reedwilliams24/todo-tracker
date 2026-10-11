package com.reedwilliams24.todotracker.core

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeParseException

/** Date-only due dates are treated as due at this local hour. */
const val DUE_HOUR = 9

const val REMINDER_TITLE = "Todo Tracker"

val REMINDER_OFFSETS: List<ReminderOffset> = ReminderOffset.entries

/** A planned notification. `key` is `<todoId>:<dueDate>:<offset>`; `at` is local wall-clock time. */
data class Reminder(val key: String, val todoId: String, val title: String, val body: String, val at: LocalDateTime)

/** 09:00 on the due date (`at`), 08:00 (`1h`), or 09:00 the day before (`1d`). */
fun reminderAt(todo: Todo): LocalDateTime? {
    val offset = todo.reminder ?: return null
    val due = todo.dueDate?.takeIf { it.isNotEmpty() } ?: return null
    val date = try {
        LocalDate.parse(due)
    } catch (_: DateTimeParseException) {
        return null
    }
    return when (offset) {
        ReminderOffset.AT -> date.atTime(DUE_HOUR, 0)
        ReminderOffset.HOUR_BEFORE -> date.atTime(DUE_HOUR - 1, 0)
        ReminderOffset.DAY_BEFORE -> date.minusDays(1).atTime(DUE_HOUR, 0)
    }
}

fun describeReminder(todo: Todo): String = when (todo.reminder) {
    null -> ""
    ReminderOffset.AT -> "Due today: ${todo.title}"
    ReminderOffset.HOUR_BEFORE -> "Due in 1 hour: ${todo.title}"
    ReminderOffset.DAY_BEFORE -> "Due tomorrow: ${todo.title}"
}

/** One reminder per open todo with a due date and a reminder offset, in list order. */
fun planReminders(todos: List<Todo>): List<Reminder> = todos.mapNotNull { todo ->
    if (todo.completed) return@mapNotNull null
    val at = reminderAt(todo) ?: return@mapNotNull null
    Reminder("${todo.id}:${todo.dueDate}:${todo.reminder!!.key}", todo.id, REMINDER_TITLE, describeReminder(todo), at)
}

/** Planned reminders whose time is at or before `now` and that have not been delivered. */
fun dueReminders(todos: List<Todo>, delivered: Set<String>, now: LocalDateTime): List<Reminder> =
    planReminders(todos).filter { !it.at.isAfter(now) && it.key !in delivered }

/** Delivered keys that still match a planned reminder. */
fun pruneDelivered(delivered: Set<String>, todos: List<Todo>): Set<String> {
    val live = planReminders(todos).mapTo(HashSet()) { it.key }
    return delivered.filterTo(LinkedHashSet()) { it in live }
}
