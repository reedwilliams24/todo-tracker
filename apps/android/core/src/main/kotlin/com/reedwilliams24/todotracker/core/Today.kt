package com.reedwilliams24.todotracker.core

import kotlinx.serialization.Serializable
import java.time.LocalDateTime

const val TODAY_LIMIT = 5

/** What the home-screen widget shows (spec/features/today.md). */
@Serializable
data class TodaySummary(
    val todos: List<Todo>,
    val dueToday: Int,
    val overdue: Int,
    val remaining: Int,
)

/** Open todos due today or earlier, then undated ones, each sorted for display; `now` is local time. */
fun todaySummary(todos: List<Todo>, now: LocalDateTime = LocalDateTime.now(), limit: Int = TODAY_LIMIT): TodaySummary {
    val today = now.toLocalDate().toString()
    val open = todos.filter { !it.completed }
    val dated = open.filter { it.dueDate != null && it.dueDate <= today }
    val undated = open.filter { it.dueDate == null }
    return TodaySummary(
        todos = (sortByPriority(dated) + sortByPriority(undated)).take(limit.coerceAtLeast(0)),
        dueToday = dated.count { it.dueDate == today },
        overdue = dated.count { it.dueDate != today },
        remaining = open.size,
    )
}

fun todaySubtitle(dueToday: Int, overdue: Int, remaining: Int): String {
    if (remaining == 0) return "All done"
    val parts = if (overdue > 0) listOf("$overdue overdue") else emptyList()
    return (parts + "$dueToday due today").joinToString(" · ")
}

fun todaySubtitle(summary: TodaySummary): String = todaySubtitle(summary.dueToday, summary.overdue, summary.remaining)

fun todayMoreLabel(shown: Int, remaining: Int): String? {
    val hidden = remaining - shown
    return if (hidden > 0) "+$hidden more" else null
}

fun todayMoreLabel(summary: TodaySummary): String? = todayMoreLabel(summary.todos.size, summary.remaining)
