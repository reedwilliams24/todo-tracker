package com.reedwilliams24.todotracker.core

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

private const val USER = "6a1f1c2e-0000-4000-8000-000000000001"

private fun row(id: String, seq: Long) =
    TodoRow(
        id = id,
        userId = USER,
        title = id,
        notes = null,
        completed = false,
        priority = TodoPriority.MEDIUM,
        dueDate = null,
        recurrence = null,
        completedAt = null,
        createdAt = "2026-01-05T09:00:00.000Z",
        updatedAt = "2026-01-05T09:00:00.000Z",
        deletedAt = null,
        serverSeq = seq,
    )

/** Counts sockets: [open] opens one, its handle's close closes it. */
private class FakeTransport : RealtimeTransport {
    val log = mutableListOf<String>()
    var opened = 0
    var live = 0
    var maxLive = 0
    var failNext = 0
    var gate: CompletableDeferred<Unit>? = null
    var onRow: ((TodoRow) -> Unit)? = null
    var onClosed: (() -> Unit)? = null

    override suspend fun refreshAuth() {
        log += "refreshAuth"
    }

    override suspend fun open(userId: String, onRow: (TodoRow) -> Unit, onClosed: () -> Unit): RealtimeChannelHandle {
        log += "open $userId"
        gate?.await()
        if (failNext > 0) {
            failNext--
            throw java.io.IOException("join failed")
        }
        opened++
        live++
        maxLive = maxOf(maxLive, live)
        this.onRow = onRow
        this.onClosed = onClosed
        var closed = false
        return RealtimeChannelHandle {
            if (!closed) {
                closed = true
                live--
                log += "close"
            }
        }
    }
}

private class FakeTarget(private val transport: FakeTransport, override val userId: String = USER) : RealtimeTarget {
    val applied = mutableListOf<List<TodoRow>>()
    var pulls = 0
    var pullGate: CompletableDeferred<Unit>? = null

    override suspend fun pull() {
        pulls++
        transport.log += "pull"
        pullGate?.await()
    }

    override fun applyRemote(rows: List<TodoRow>) {
        applied += rows
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class RealtimeConnectionTest {
    @Test
    fun `refreshes the token, joins, then pulls before it is connected`() = runTest {
        val transport = FakeTransport()
        val connection = RealtimeConnection(transport, backgroundScope)
        connection.connect(FakeTarget(transport))
        assertEquals(ConnectionState.CONNECTING, connection.state.value)
        runCurrent()
        assertEquals(listOf("refreshAuth", "open $USER", "pull"), transport.log)
        assertEquals(ConnectionState.CONNECTED, connection.state.value)
    }

    @Test
    fun `repeated connects and foreground events never open a second socket`() = runTest {
        val transport = FakeTransport()
        val connection = RealtimeConnection(transport, backgroundScope)
        val target = FakeTarget(transport)
        connection.connect(target)
        connection.connect(target)
        runCurrent()
        connection.connect(target)
        connection.connect(FakeTarget(transport))
        runCurrent()
        assertEquals(1, transport.opened)
        assertEquals(1, transport.maxLive)
        assertEquals(1, target.pulls)
        assertEquals(ConnectionState.CONNECTED, connection.state.value)
    }

    @Test
    fun `background then foreground closes the socket and reconnects with a fresh pull`() = runTest {
        val transport = FakeTransport()
        val connection = RealtimeConnection(transport, backgroundScope)
        val target = FakeTarget(transport)
        repeat(3) {
            connection.connect(target)
            runCurrent()
            connection.disconnect()
            runCurrent()
            assertEquals(0, transport.live)
            assertEquals(ConnectionState.OFFLINE, connection.state.value)
        }
        assertEquals(3, transport.opened)
        assertEquals(1, transport.maxLive)
        assertEquals(3, target.pulls)
    }

    @Test
    fun `hands live rows to applyRemote, holding the ones that arrive during the pull`() = runTest {
        val transport = FakeTransport()
        val connection = RealtimeConnection(transport, backgroundScope)
        val target = FakeTarget(transport).apply { pullGate = CompletableDeferred() }
        connection.connect(target)
        runCurrent()
        transport.onRow!!(row("a", 6))
        assertEquals(emptyList<List<TodoRow>>(), target.applied)
        target.pullGate!!.complete(Unit)
        runCurrent()
        assertEquals(listOf(listOf(row("a", 6))), target.applied)
        transport.onRow!!(row("b", 7))
        assertEquals(listOf(listOf(row("a", 6)), listOf(row("b", 7))), target.applied)
    }

    @Test
    fun `drops rows from a channel it already left`() = runTest {
        val transport = FakeTransport()
        val connection = RealtimeConnection(transport, backgroundScope)
        val target = FakeTarget(transport)
        connection.connect(target)
        runCurrent()
        val onRow = transport.onRow!!
        val onClosed = transport.onClosed!!
        connection.disconnect()
        onRow(row("a", 6))
        onClosed()
        runCurrent()
        assertTrue(target.applied.isEmpty())
        assertEquals(ConnectionState.OFFLINE, connection.state.value)
    }

    @Test
    fun `retries with backoff while connecting, and resets after it connects`() = runTest {
        val transport = FakeTransport().apply { failNext = 2 }
        val connection = RealtimeConnection(transport, backgroundScope)
        connection.connect(FakeTarget(transport))
        runCurrent()
        assertEquals(ConnectionState.CONNECTING, connection.state.value)
        advanceTimeBy(999)
        runCurrent()
        assertEquals(1, transport.log.count { it.startsWith("open") }) // still waiting
        advanceTimeBy(2)
        runCurrent()
        assertEquals(2, transport.log.count { it.startsWith("open") }) // attempt 1 at 1000 ms
        advanceTimeBy(2001)
        runCurrent()
        assertEquals(ConnectionState.CONNECTED, connection.state.value)
        transport.onClosed!!()
        runCurrent()
        assertEquals(0, transport.live)
        assertEquals(ConnectionState.CONNECTING, connection.state.value)
        advanceTimeBy(1001)
        runCurrent()
        assertEquals(ConnectionState.CONNECTED, connection.state.value)
        assertEquals(1, transport.maxLive)
    }

    @Test
    fun `connect during a backoff retries now instead of waiting`() = runTest {
        val transport = FakeTransport().apply { failNext = 1 }
        val connection = RealtimeConnection(transport, backgroundScope)
        val target = FakeTarget(transport)
        connection.connect(target)
        runCurrent()
        assertEquals(ConnectionState.CONNECTING, connection.state.value)
        connection.connect(target)
        runCurrent()
        assertEquals(ConnectionState.CONNECTED, connection.state.value)
    }

    @Test
    fun `disconnecting mid-join closes the channel once it opens`() = runTest {
        val transport = FakeTransport().apply { gate = CompletableDeferred() }
        val connection = RealtimeConnection(transport, backgroundScope)
        val target = FakeTarget(transport)
        connection.connect(target)
        runCurrent()
        connection.disconnect()
        transport.gate!!.complete(Unit)
        runCurrent()
        assertEquals(0, transport.live)
        assertEquals(0, target.pulls)
        assertEquals(ConnectionState.OFFLINE, connection.state.value)
    }

    @Test
    fun `a different user disconnects the old channel first`() = runTest {
        val transport = FakeTransport()
        val connection = RealtimeConnection(transport, backgroundScope)
        connection.connect(FakeTarget(transport))
        runCurrent()
        connection.connect(FakeTarget(transport, "other"))
        runCurrent()
        assertTrue("close" in transport.log)
        assertEquals("open other", transport.log[transport.log.size - 2])
        assertEquals(1, transport.maxLive)
    }
}
