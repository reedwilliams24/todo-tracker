package com.reedwilliams24.todotracker.core

import java.time.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** One row of the backend `todos` table (spec/features/sync.md). Timestamps use the Todo format. */
@Serializable
data class TodoRow(
    val id: String,
    @SerialName("user_id") val userId: String,
    val title: String,
    val notes: String? = null,
    val completed: Boolean,
    val priority: TodoPriority,
    @SerialName("due_date") val dueDate: String? = null,
    val recurrence: Recurrence? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    /** Tombstone: set when the todo was deleted. */
    @SerialName("deleted_at") val deletedAt: String? = null,
    /** Assigned by the server on every write; null on rows the client hasn't pushed yet. */
    @SerialName("server_seq") val serverSeq: Long? = null,
)

/** Row JSON: every column is written, nulls included, so a push can clear a field. */
val RowJson = Json {
    encodeDefaults = true
    ignoreUnknownKeys = true
}

val SYNC_COLUMNS: List<String> =
    listOf(
        "id",
        "user_id",
        "title",
        "notes",
        "completed",
        "priority",
        "due_date",
        "recurrence",
        "completed_at",
        "created_at",
        "updated_at",
        "deleted_at",
        "server_seq",
    )

/** The row to push for a todo. [deletedAt] turns it into a tombstone. `reminder` is device-local and not synced. */
fun toRow(todo: Todo, userId: String, deletedAt: Instant? = null): TodoRow =
    TodoRow(
        id = todo.id,
        userId = userId,
        title = todo.title,
        notes = todo.notes,
        completed = todo.completed,
        priority = todo.priority,
        dueDate = todo.dueDate,
        recurrence = todo.recurrence,
        completedAt = todo.completedAt,
        createdAt = todo.createdAt,
        updatedAt = todo.updatedAt,
        deletedAt = deletedAt?.let(::timestamp),
        serverSeq = null,
    )

fun fromRow(row: TodoRow): Todo =
    Todo(
        id = row.id,
        title = row.title,
        notes = row.notes,
        completed = row.completed,
        priority = row.priority,
        dueDate = row.dueDate,
        recurrence = row.recurrence,
        createdAt = row.createdAt,
        updatedAt = row.updatedAt,
        completedAt = row.completedAt,
    )

/**
 * Applies pulled or Realtime rows to the local list. Rows at or below [cursor] are ignored, tombstones remove the todo,
 * and otherwise the newer `updated_at` wins (ties go to the server) against both the local copy and any in-flight push
 * for that todo.
 */
fun applyRemote(local: List<Todo>, inFlight: List<Todo>, rows: List<TodoRow>, cursor: Long): List<Todo> {
    val pending = inFlight.associateBy { it.id }
    val todos = local.toMutableList()
    for (row in rows) {
        val seq = row.serverSeq
        if (seq == null || seq <= cursor) continue
        val index = todos.indexOfFirst { it.id == row.id }
        if (row.deletedAt != null) {
            if (index >= 0) todos.removeAt(index)
            continue
        }
        val mine = pending[row.id]
        if (mine != null && mine.updatedAt > row.updatedAt) continue
        val current = todos.getOrNull(index)
        if (current != null && current.updatedAt > row.updatedAt) continue
        var incoming = fromRow(row)
        if (current?.reminder != null && incoming.dueDate != null) incoming = incoming.copy(reminder = current.reminder)
        if (current?.subtasks != null) incoming = incoming.copy(subtasks = current.subtasks)
        if (index >= 0) todos[index] = incoming else todos.add(0, incoming)
    }
    return todos
}

/** The highest `server_seq` seen; never moves backwards. */
fun advanceCursor(cursor: Long, rows: List<TodoRow>): Long =
    rows.mapNotNull { it.serverSeq }.fold(cursor) { max, seq -> maxOf(max, seq) }

/**
 * Undoes the local effect of a failed push. [before] is the list as it was before the edit. A failed todo goes back to
 * its [before] version, is removed if it was new, or is put back where it was if its delete failed.
 */
fun rollbackPush(local: List<Todo>, before: List<Todo>, failedIds: List<String>): List<Todo> {
    val failed = failedIds.toSet()
    val prior = before.associateBy { it.id }
    val todos = mutableListOf<Todo>()
    for (todo in local) {
        if (todo.id !in failed) todos.add(todo) else prior[todo.id]?.let(todos::add)
    }
    before.forEachIndexed { i, todo ->
        if (todo.id !in failed || todos.any { it.id == todo.id }) return@forEachIndexed
        var at = 0
        for (j in i - 1 downTo 0) {
            val k = todos.indexOfFirst { it.id == before[j].id }
            if (k >= 0) {
                at = k + 1
                break
            }
        }
        todos.add(at, todo)
    }
    return todos
}

/**
 * Rows for the sign-in "Move" choice: every guest todo becomes a new account row with a fresh id, so it never
 * overwrites an account todo. Its fields are kept and `updated_at` is the time of the move.
 */
fun guestToRows(guest: List<Todo>, userId: String, now: Instant): List<TodoRow> {
    val stamp = timestamp(now)
    return guest.map { toRow(it, userId).copy(id = generateId(), updatedAt = stamp) }
}

/** A local edit ready to push: the list to show and the rows to send (spec/features/sync.md#push). */
data class PushPlan(val todos: List<Todo>, val rows: List<TodoRow>)

/**
 * Turns a local edit ([before] -> [after]) into rows to push. Added or changed todos become rows, removed ones
 * tombstones. A change that doesn't move `updated_at` forward (an undo) is stamped [now] so it wins LWW, and a todo
 * brought back after its tombstone was pushed ([tombstoned]) gets a fresh id, since tombstones always win.
 */
fun planPush(
    before: List<Todo>,
    after: List<Todo>,
    tombstoned: Collection<String>,
    userId: String,
    now: Instant,
): PushPlan {
    val stamp = timestamp(now)
    val prior = before.associateBy { it.id }
    val kept = after.map { it.id }.toSet()
    val rows = mutableListOf<TodoRow>()
    val todos =
        after.map { todo ->
            val prev = prior[todo.id]
            val next =
                when {
                    prev == null && todo.id in tombstoned -> todo.copy(id = generateId(), updatedAt = stamp)
                    prev == null -> todo
                    toRow(prev, userId) == toRow(todo, userId) -> return@map todo
                    todo.updatedAt <= prev.updatedAt -> todo.copy(updatedAt = stamp)
                    else -> todo
                }
            rows.add(toRow(next, userId))
            next
        }
    before.filter { it.id !in kept }.forEach { rows.add(toRow(it.copy(updatedAt = stamp), userId, now)) }
    return PushPlan(todos, rows)
}
