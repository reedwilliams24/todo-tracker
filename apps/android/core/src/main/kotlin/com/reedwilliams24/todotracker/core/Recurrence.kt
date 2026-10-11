package com.reedwilliams24.todotracker.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

val RECURRENCES: List<Recurrence> = Recurrence.entries

/** Next due date on calendar days; monthly clamps to the last day of a shorter month. */
fun nextOccurrence(dueDate: String, recurrence: Recurrence): String {
    val date = LocalDate.parse(dueDate)
    return when (recurrence) {
        Recurrence.DAILY -> date.plusDays(1)
        Recurrence.WEEKLY -> date.plusWeeks(1)
        Recurrence.MONTHLY -> date.plusMonths(1)
    }.toString()
}

/** The todo that replaces a completed recurring one, or null if it doesn't repeat. */
fun scheduleNext(todo: Todo, now: Instant = Instant.now()): Todo? {
    val recurrence = todo.recurrence ?: return null
    val base = todo.dueDate ?: now.atOffset(ZoneOffset.UTC).toLocalDate().toString()
    return createTodo(
        TodoDraft(
            title = todo.title,
            notes = todo.notes,
            priority = todo.priority,
            dueDate = nextOccurrence(base, recurrence),
            recurrence = recurrence,
        ),
        now,
    )
}
