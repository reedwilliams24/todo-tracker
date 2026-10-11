package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** `realtime` ops; mirrors packages/spec/src/features/realtime.ts. */
internal val realtimeOps: Map<String, Op> =
    mapOf(
        "realtimeConstants" to
            { _: JsonObject ->
                buildJsonObject {
                    put("schema", REALTIME_SCHEMA)
                    put("table", REALTIME_TABLE)
                    put("reconnectBaseMs", RECONNECT_BASE_MS)
                    put("reconnectMaxMs", RECONNECT_MAX_MS)
                }
            },
        "realtimeTopic" to
            { g: JsonObject ->
                val topic = realtimeTopic(g.str("userId"))
                buildJsonObject {
                    put("channel", topic.channel)
                    put("filter", topic.filter)
                }
            },
        "reconnectDelayMs" to
            { g: JsonObject ->
                JsonPrimitive(reconnectDelayMs(g.getValue("attempt").jsonPrimitive.int))
            },
    )
