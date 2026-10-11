package com.reedwilliams24.todotracker.data

import com.reedwilliams24.todotracker.core.TodoChangeFilter
import com.reedwilliams24.todotracker.core.TodoJson
import com.reedwilliams24.todotracker.core.realtimeTopic
import com.reedwilliams24.todotracker.core.todoChangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

/**
 * Supabase Realtime (Phoenix channel protocol) for the user's todo rows. Calls [onChange] once the channel
 * is joined (so changes made while disconnected show up) and on every row change. Reconnects with a fresh
 * access token when the socket drops. Call [close] to stop.
 */
class TodoChangeFeed(
    private val account: AccountSession,
    private val userId: String,
    scope: CoroutineScope,
    private val onChange: () -> Unit,
) {
    private val http = OkHttpClient()
    private val topic = "realtime:${realtimeTopic(userId)}"
    private val closed = Channel<Unit>(Channel.CONFLATED)
    private var socket: WebSocket? = null
    private var ref = 0
    private val job: Job = scope.launch { run() }

    fun close() {
        job.cancel()
        socket?.close(1000, null)
        http.dispatcher.executorService.shutdown()
    }

    private suspend fun CoroutineScope.run() {
        var backoff = 1_000L
        while (isActive) {
            val joined = try {
                connect(account.authorized { it })
            } catch (_: Exception) {
                false
            }
            socket?.cancel()
            socket = null
            if (joined) backoff = 1_000L
            delay(backoff)
            backoff = (backoff * 2).coerceAtMost(30_000L)
        }
    }

    /** Runs one socket until it drops; returns whether the channel was ever joined. */
    private suspend fun CoroutineScope.connect(initialToken: String): Boolean {
        var joined = false
        var token = initialToken
        while (closed.tryReceive().isSuccess) Unit
        val config = account.client.config
        val url = config.url.trimEnd('/').replaceFirst("http", "ws") +
            "/realtime/v1/websocket?apikey=${config.anonKey}&vsn=1.0.0"
        val listener = object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val message = runCatching { TodoJson.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
                if (message.string("topic") != topic) return
                when (message.string("event")) {
                    "phx_reply" -> {
                        val status = message["payload"]?.jsonObject?.string("status")
                        if (message.string("ref") == JOIN_REF && status == "ok") {
                            joined = true
                            onChange()
                        } else if (message.string("ref") == JOIN_REF) {
                            webSocket.close(1000, null)
                        }
                    }
                    "postgres_changes" -> onChange()
                    "phx_error", "phx_close" -> webSocket.close(1000, null)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
                closed.trySend(Unit)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                closed.trySend(Unit)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                closed.trySend(Unit)
            }
        }
        val ws = http.newWebSocket(Request.Builder().url(url).build(), listener)
        socket = ws
        ws.send(join(token))
        val heartbeat = launch {
            while (isActive) {
                delay(HEARTBEAT_MS)
                ws.send(message("phoenix", "heartbeat", JsonObject(emptyMap()), next()))
                val fresh = runCatching { account.authorized { it } }.getOrNull()
                if (fresh != null && fresh != token) {
                    token = fresh
                    ws.send(message(topic, "access_token", buildJsonObject { put("access_token", fresh) }, next()))
                }
            }
        }
        closed.receive()
        heartbeat.cancel()
        return joined
    }

    private fun join(token: String): String {
        val filter = TodoJson.encodeToJsonElement(TodoChangeFilter.serializer(), todoChangeFilter(userId))
        val payload = buildJsonObject {
            put(
                "config",
                buildJsonObject {
                    put("broadcast", buildJsonObject { put("self", false); put("ack", false) })
                    put("presence", buildJsonObject { put("key", "") })
                    put("postgres_changes", buildJsonArray { add(filter) })
                    put("private", false)
                },
            )
            put("access_token", token)
        }
        return message(topic, "phx_join", payload, JOIN_REF, joinRef = JOIN_REF)
    }

    private fun next() = (++ref + 1).toString()

    private fun message(topic: String, event: String, payload: JsonObject, ref: String, joinRef: String? = null) =
        buildJsonObject {
            put("topic", topic)
            put("event", event)
            put("payload", payload)
            put("ref", ref)
            if (joinRef != null) put("join_ref", joinRef)
        }.toString()

    private fun JsonObject.string(key: String): String? =
        (get(key) as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull

    private companion object {
        const val JOIN_REF = "1"
        const val HEARTBEAT_MS = 25_000L
    }
}
