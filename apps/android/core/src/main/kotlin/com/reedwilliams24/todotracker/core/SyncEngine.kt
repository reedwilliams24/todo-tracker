package com.reedwilliams24.todotracker.core

import java.time.Instant
import kotlin.coroutines.cancellation.CancellationException

/** Rows per pull request (spec/server.md#pull). */
const val PULL_PAGE_SIZE = 500

/** The backend calls sync needs (spec/server.md). */
interface SyncServer {
    suspend fun push(rows: List<TodoRow>): List<TodoRow>

    /** Rows with `server_seq > cursor`, ordered by `server_seq`, at most [limit]. */
    suspend fun pull(cursor: Long, limit: Int): List<TodoRow>
}

interface CursorStore {
    fun load(): Long

    fun save(cursor: Long)
}

/** The list the engine keeps in step: read the current todos, replace them without a new push. */
interface TodoListHost {
    val current: List<Todo>

    fun replace(todos: List<Todo>)
}

/**
 * Keeps a signed-in list in step with the server (spec/features/sync.md). [edit] pushes each local change and rolls it
 * back if the push fails; [pull] and [applyRemote] bring in other devices' changes (REED-70 feeds Realtime rows to
 * [applyRemote]). Call it from one thread (the main thread).
 */
class SyncEngine(
    private val server: SyncServer,
    private val userId: String,
    private val cursor: CursorStore,
    private val list: TodoListHost,
    private val onPushFailed: () -> Unit,
    private val now: () -> Instant = Instant::now,
) {
    private val inFlight = mutableMapOf<Int, List<Todo>>()
    private val tombstoned = mutableSetOf<String>()
    private var nextPush = 0
    private var pulling = false
    private var pullAgain = false
    private var closed = false

    /** A local edit from [before] to [after] (already shown): shows the planned list and pushes it. */
    suspend fun edit(before: List<Todo>, after: List<Todo>) {
        val plan = planPush(before, after, tombstoned.toSet(), userId, now())
        if (plan.todos.indices.any { plan.todos[it] !== after[it] }) list.replace(plan.todos)
        if (plan.rows.isEmpty()) return
        val ids = plan.rows.map { it.id }
        val idSet = ids.toSet()
        val key = nextPush++
        inFlight[key] = plan.todos.filter { it.id in idSet }
        val stored =
            try {
                server.push(plan.rows)
            } catch (e: CancellationException) {
                inFlight.remove(key)
                throw e
            } catch (e: Exception) {
                inFlight.remove(key)
                if (!closed) {
                    list.replace(rollbackPush(list.current, before, ids))
                    onPushFailed()
                }
                return
            }
        inFlight.remove(key)
        if (closed) return
        plan.rows.filter { it.deletedAt != null }.forEach { tombstoned.add(it.id) }
        list.replace(applyRemote(list.current, pending(), stored, 0))
    }

    /** Pulls every row past the cursor, a page at a time. A call during a pull makes it run once more. */
    suspend fun pull() {
        if (pulling) {
            pullAgain = true
            return
        }
        pulling = true
        try {
            do {
                pullAgain = false
                pullPages()
            } while (pullAgain && !closed)
        } finally {
            pulling = false
        }
    }

    /** Applies pulled or Realtime rows and advances the stored cursor. */
    fun applyRemote(rows: List<TodoRow>) {
        if (closed || rows.isEmpty()) return
        val from = cursor.load()
        list.replace(applyRemote(list.current, pending(), rows, from))
        cursor.save(advanceCursor(from, rows))
    }

    /** Stops applying results (sign out, scope change). */
    fun close() {
        closed = true
    }

    private suspend fun pullPages() {
        while (!closed) {
            val rows = server.pull(cursor.load(), PULL_PAGE_SIZE)
            applyRemote(rows)
            if (rows.size < PULL_PAGE_SIZE) return
        }
    }

    private fun pending(): List<Todo> = inFlight.values.flatten()
}
