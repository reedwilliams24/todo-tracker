package com.reedwilliams24.todotracker.core

import kotlin.coroutines.cancellation.CancellationException
import kotlin.math.min
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Live updates over the Supabase Realtime socket. Rules: spec/features/realtime.md.

enum class ConnectionState {
    OFFLINE,
    CONNECTING,
    CONNECTED,
}

const val REALTIME_SCHEMA = "public"
const val REALTIME_TABLE = "todos"
const val RECONNECT_BASE_MS = 1_000L
const val RECONNECT_MAX_MS = 30_000L

data class RealtimeTopic(val channel: String, val filter: String)

/** The one channel a signed-in client joins, and the postgres_changes filter that scopes it to the user. */
fun realtimeTopic(userId: String) = RealtimeTopic(channel = "$REALTIME_TABLE:$userId", filter = "user_id=eq.$userId")

/** Delay before reconnect attempt [attempt] (0-based): doubles from the base, capped at the max. */
fun reconnectDelayMs(attempt: Int): Long = min(RECONNECT_MAX_MS, RECONNECT_BASE_MS shl attempt.coerceIn(0, 16))

/** A joined channel; [close] leaves it and closes the socket. */
fun interface RealtimeChannelHandle {
    suspend fun close()
}

/** The Supabase Realtime socket, behind an interface so the lifecycle can be tested without a server. */
interface RealtimeTransport {
    /** Refreshes the access token if it's close to expiry and hands it to the socket. */
    suspend fun refreshAuth()

    /**
     * Opens the socket and joins the user's `todos` channel; returns once joined. [onRow] gets each new row, [onClosed]
     * fires if the channel drops after joining. Both are called on the connection's scope.
     */
    suspend fun open(userId: String, onRow: (TodoRow) -> Unit, onClosed: () -> Unit): RealtimeChannelHandle
}

/** The signed-in list the connection feeds: REED-68's [SyncEngine]. */
interface RealtimeTarget {
    val userId: String

    suspend fun pull()

    fun applyRemote(rows: List<TodoRow>)
}

/**
 * Owns the app's one Realtime socket and `todos` channel. Not thread-safe: call it, and have the transport call back,
 * on [scope]'s (single) thread.
 */
class RealtimeConnection(private val transport: RealtimeTransport, private val scope: CoroutineScope) {
    private val _state = MutableStateFlow(ConnectionState.OFFLINE)
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private var target: RealtimeTarget? = null
    private var channel: RealtimeChannelHandle? = null
    private var held: MutableList<TodoRow>? = null
    private var job: Job? = null
    private var waiting = false
    private var attempt = 0
    /** Bumped on every (re)start and disconnect, so callbacks from an older attempt are dropped. */
    private var generation = 0

    fun connect(next: RealtimeTarget) {
        if (_state.value != ConnectionState.OFFLINE && target?.userId == next.userId) {
            target = next
            if (waiting) start()
            return
        }
        if (_state.value != ConnectionState.OFFLINE) disconnect()
        target = next
        attempt = 0
        start()
    }

    fun disconnect() {
        generation++
        stop()
        target = null
        _state.value = ConnectionState.OFFLINE
    }

    private fun start(delayMs: Long = 0) {
        job?.cancel()
        val gen = ++generation
        _state.value = ConnectionState.CONNECTING
        waiting = delayMs > 0
        job =
            scope.launch {
                if (delayMs > 0) delay(delayMs)
                waiting = false
                run(gen)
            }
    }

    private suspend fun run(gen: Int) {
        val live = { gen == generation }
        try {
            transport.refreshAuth()
            if (!live()) return
            held = mutableListOf()
            val opened =
                transport.open(
                    target!!.userId,
                    onRow = { row -> if (live()) held?.add(row) ?: target?.applyRemote(listOf(row)) },
                    onClosed = { if (live()) fail() },
                )
            if (!live()) {
                closeQuietly(opened)
                return
            }
            channel = opened
            target!!.pull()
            if (!live()) return
            val rows = held.orEmpty()
            held = null
            if (rows.isNotEmpty()) target!!.applyRemote(rows)
            attempt = 0
            _state.value = ConnectionState.CONNECTED
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            if (live()) fail()
        }
    }

    private fun fail() {
        generation++
        stop()
        start(reconnectDelayMs(attempt++))
    }

    private fun stop() {
        job?.cancel()
        job = null
        waiting = false
        held = null
        val closing = channel ?: return
        channel = null
        scope.launch { closeQuietly(closing) }
    }

    private suspend fun closeQuietly(handle: RealtimeChannelHandle) =
        withContext(NonCancellable) { runCatching { handle.close() } }
}
