package com.reedwilliams24.todotracker.core

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

const val STATS_DAYS = 30

@Serializable
data class DayCount(val date: String, val count: Int)

@Serializable
data class TodoStats(
    /** Oldest first, exactly `days` entries ending today. */
    val perDay: List<DayCount>,
    val totalCompleted: Int,
    val currentStreak: Int,
    val longestStreak: Int,
)

/** Completions per calendar day in [zone], for completed todos with a valid `completedAt`. */
fun completionsByDay(todos: List<Todo>, zone: ZoneId = ZoneId.systemDefault()): Map<LocalDate, Int> {
    val counts = mutableMapOf<LocalDate, Int>()
    for (todo in todos) {
        if (!todo.completed) continue
        val at = todo.completedAt?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: continue
        val day = at.atZone(zone).toLocalDate()
        counts[day] = (counts[day] ?: 0) + 1
    }
    return counts
}

/** Consecutive days with a completion, ending today or yesterday (today doesn't break a streak until it's over). */
fun currentStreak(counts: Map<LocalDate, Int>, today: LocalDate): Int {
    var cursor = if (today in counts) today else today.minusDays(1)
    var streak = 0
    while (cursor in counts) {
        streak++
        cursor = cursor.minusDays(1)
    }
    return streak
}

fun longestStreak(counts: Map<LocalDate, Int>): Int {
    var best = 0
    var run = 0
    var previous: LocalDate? = null
    for (day in counts.keys.sorted()) {
        run = if (previous != null && previous.plusDays(1) == day) run + 1 else 1
        best = maxOf(best, run)
        previous = day
    }
    return best
}

fun computeStats(
    todos: List<Todo>,
    now: Instant = Instant.now(),
    days: Int = STATS_DAYS,
    zone: ZoneId = ZoneId.systemDefault(),
): TodoStats {
    val counts = completionsByDay(todos, zone)
    val today = now.atZone(zone).toLocalDate()
    return TodoStats(
        perDay = (days - 1 downTo 0).map { offset ->
            val day = today.minusDays(offset.toLong())
            DayCount(day.toString(), counts[day] ?: 0)
        },
        totalCompleted = counts.values.sum(),
        currentStreak = currentStreak(counts, today),
        longestStreak = longestStreak(counts),
    )
}
