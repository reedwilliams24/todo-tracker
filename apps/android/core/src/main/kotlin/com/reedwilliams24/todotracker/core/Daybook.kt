package com.reedwilliams24.todotracker.core

import java.time.Instant
import java.time.ZoneId

/** The Today view's groups. Each keeps the input order (the user's chosen sort). */
data class DaybookSections(
    /** Open, due before today. Shown first, without guilt ("From Fri"). */
    val slipped: List<Todo>,
    /** Open, due today or undated. */
    val today: List<Todo>,
    /** Open, due after today. */
    val later: List<Todo>,
    val done: List<Todo>,
)

data class DaybookProgress(val done: Int, val total: Int)

data class UpcomingDay(val date: String, val todos: List<Todo>)

/** Splits todos into the Today view's groups; [today] is a YYYY-MM-DD key. */
fun daybookSections(todos: List<Todo>, today: String): DaybookSections {
    val slipped = mutableListOf<Todo>()
    val current = mutableListOf<Todo>()
    val later = mutableListOf<Todo>()
    val done = mutableListOf<Todo>()
    for (todo in todos) {
        val due = todo.dueDate
        when {
            todo.completed -> done += todo
            due != null && due < today -> slipped += todo
            due != null && due > today -> later += todo
            else -> current += todo
        }
    }
    return DaybookSections(slipped, current, later, done)
}

/**
 * Progress ring: todos completed today out of today's load (completed today plus open slipped, due-today and undated
 * todos), in [zone].
 */
fun daybookProgress(todos: List<Todo>, now: Instant, zone: ZoneId = ZoneId.systemDefault()): DaybookProgress {
    val today = now.atZone(zone).toLocalDate()
    val todayKey = today.toString()
    var done = 0
    var open = 0
    for (todo in todos) {
        if (todo.completed) {
            val at = todo.completedAt?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: continue
            if (at.atZone(zone).toLocalDate() == today) done++
        } else if (todo.dueDate == null || todo.dueDate <= todayKey) {
            open++
        }
    }
    return DaybookProgress(done, done + open)
}

/** Open todos due today or later, one entry per due date, soonest first. */
fun upcomingDays(todos: List<Todo>, today: String): List<UpcomingDay> =
    todos
        .filter { !it.completed && it.dueDate != null && it.dueDate >= today }
        .groupBy { it.dueDate!! }
        .toSortedMap()
        .map { (date, list) -> UpcomingDay(date, list) }
