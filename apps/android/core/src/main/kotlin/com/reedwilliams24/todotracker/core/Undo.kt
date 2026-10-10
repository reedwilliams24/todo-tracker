package com.reedwilliams24.todotracker.core

const val UNDO_TIMEOUT_MS = 5000L

/** A snapshot of the list before a destructive action, so it can be restored exactly. */
data class UndoEntry(val label: String, val before: List<Todo>, val at: Long)

enum class UndoKind { COMPLETE, DELETE }

fun describeUndo(action: UndoKind, count: Int): String {
    val noun = if (count == 1) "todo" else "$count todos"
    return if (action == UndoKind.COMPLETE) "Completed $noun" else "Deleted $noun"
}

fun isUndoExpired(entry: UndoEntry, now: Long, timeoutMs: Long = UNDO_TIMEOUT_MS): Boolean = now - entry.at >= timeoutMs
