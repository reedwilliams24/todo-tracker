package com.reedwilliams24.todotracker.core

import java.time.Instant
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

private const val USER = "user-1"
private const val T0 = "2026-01-05T09:00:00.000Z"
private const val T1 = "2026-01-05T10:00:00.000Z"
private val NOW = Instant.parse("2026-01-06T12:00:00.000Z")

private fun todo(id: String, title: String = "Todo $id", updatedAt: String = T0, completed: Boolean = false) =
    Todo(
        id = id,
        title = title,
        completed = completed,
        priority = TodoPriority.MEDIUM,
        createdAt = T0,
        updatedAt = updatedAt,
    )

/** In-memory `todos` table: LWW on updated_at, tombstones win, server_seq per write. */
private class FakeServer : SyncServer {
    val rows = linkedMapOf<String, TodoRow>()
    var seq = 0L
    var failPush = false
    val pulls = mutableListOf<Long>()

    override suspend fun push(rows: List<TodoRow>): List<TodoRow> {
        if (failPush) throw java.io.IOException("offline")
        for (row in rows) {
            val stored = this.rows[row.id]
            if (
                stored != null &&
                    (stored.deletedAt != null || (row.deletedAt == null && stored.updatedAt > row.updatedAt))
            ) {
                continue
            }
            this.rows[row.id] = row.copy(serverSeq = ++seq)
        }
        return rows.map { this.rows.getValue(it.id) }
    }

    override suspend fun pull(cursor: Long, limit: Int): List<TodoRow> {
        pulls.add(cursor)
        return rows.values.filter { it.serverSeq!! > cursor }.sortedBy { it.serverSeq }.take(limit)
    }

    fun write(id: String, title: String = "Todo $id", updatedAt: String = T1, deletedAt: String? = null) {
        rows[id] =
            TodoRow(
                id = id,
                userId = USER,
                title = title,
                completed = false,
                priority = TodoPriority.MEDIUM,
                createdAt = T0,
                updatedAt = updatedAt,
                deletedAt = deletedAt,
                serverSeq = ++seq,
            )
    }
}

private class Harness(initial: List<Todo> = emptyList()) {
    val server = FakeServer()
    var todos = initial
    var cursor = 0L
    var failures = 0
    val engine =
        SyncEngine(
            server,
            USER,
            object : CursorStore {
                override fun load() = cursor

                override fun save(cursor: Long) {
                    this@Harness.cursor = cursor
                }
            },
            object : TodoListHost {
                override val current: List<Todo>
                    get() = todos

                override fun replace(todos: List<Todo>) {
                    this@Harness.todos = todos
                }
            },
            onPushFailed = { failures++ },
            now = { NOW },
        )

    /** A local edit the way the UI makes one: show [after], then hand it to the engine. */
    suspend fun edit(after: List<Todo>) {
        val before = todos
        todos = after
        engine.edit(before, after)
    }
}

class SyncEngineTest {
    @Test
    fun `pushes an add`() = runBlocking {
        val h = Harness()
        h.edit(listOf(todo("a")))
        assertEquals("Todo a", h.server.rows["a"]?.title)
        assertEquals(listOf("a"), h.todos.map { it.id })
        assertEquals(0, h.failures)
    }

    @Test
    fun `pushes a delete as a tombstone`() = runBlocking {
        val h = Harness()
        h.edit(listOf(todo("a"), todo("b")))
        h.edit(listOf(todo("b")))
        assertEquals(timestamp(NOW), h.server.rows["a"]?.deletedAt)
    }

    @Test
    fun `rolls back a failed push and reports it`() = runBlocking {
        val h = Harness(listOf(todo("a")))
        h.server.failPush = true
        h.edit(listOf(todo("a", title = "Renamed", updatedAt = T1)))
        assertEquals(listOf(todo("a")), h.todos)
        assertEquals(1, h.failures)
    }

    @Test
    fun `rolls back a failed add`() = runBlocking {
        val h = Harness(listOf(todo("a")))
        h.server.failPush = true
        h.edit(listOf(todo("new"), todo("a")))
        assertEquals(listOf("a"), h.todos.map { it.id })
    }

    @Test
    fun `an undone delete gets a fresh id so it survives the tombstone`() = runBlocking {
        val h = Harness()
        h.edit(listOf(todo("a")))
        h.edit(emptyList())
        h.edit(listOf(todo("a")))
        val restored = h.todos.single()
        assertNotEquals("a", restored.id)
        assertNull(h.server.rows.getValue(restored.id).deletedAt)
    }

    @Test
    fun `an undone edit is stamped now so it wins on the server`() = runBlocking {
        val h = Harness(listOf(todo("a")))
        h.edit(listOf(todo("a", completed = true, updatedAt = T1)))
        h.edit(listOf(todo("a")))
        assertEquals(false, h.server.rows["a"]?.completed)
        assertEquals(false, h.todos.single().completed)
    }

    @Test
    fun `pulls every page and advances the cursor`() = runBlocking {
        val h = Harness()
        repeat(PULL_PAGE_SIZE + 3) { h.server.write("r$it") }
        h.engine.pull()
        assertEquals(listOf(0L, PULL_PAGE_SIZE.toLong()), h.server.pulls)
        assertEquals(PULL_PAGE_SIZE + 3, h.todos.size)
        assertEquals((PULL_PAGE_SIZE + 3).toLong(), h.cursor)
    }

    @Test
    fun `pulls another device's edit and delete`() = runBlocking {
        val h = Harness()
        h.server.write("a")
        h.server.write("b")
        h.engine.pull()
        h.server.write("a", title = "Edited elsewhere", updatedAt = "2026-01-05T11:00:00.000Z")
        h.server.write("b", deletedAt = T1)
        h.engine.pull()
        assertEquals(listOf("Edited elsewhere"), h.todos.map { it.title })
    }

    @Test
    fun `ignores results after close`() = runBlocking {
        val h = Harness(listOf(todo("a")))
        h.server.failPush = true
        h.engine.close()
        h.edit(emptyList())
        assertEquals(emptyList<Todo>(), h.todos)
        assertEquals(0, h.failures)
    }
}
