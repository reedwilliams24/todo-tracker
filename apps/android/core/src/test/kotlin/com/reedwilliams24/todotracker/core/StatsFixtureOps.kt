package com.reedwilliams24.todotracker.core

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicContainer
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.io.File
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId

/** `stats` ops; mirrors packages/spec/src/features/stats.ts. */
internal val statsOps: Map<String, Op> = mapOf(
    "statsConstants" to { _: JsonObject -> buildJsonObject { put("statsDays", STATS_DAYS) } },
    "computeStats" to { g: JsonObject ->
        TodoJson.encodeToJsonElement(
            TodoStats.serializer(),
            computeStats(
                g.todos(),
                g.instant("now"),
                g["days"]?.jsonPrimitive?.int ?: STATS_DAYS,
                g["timeZone"]?.jsonPrimitive?.content?.let(ZoneId::of) ?: ZoneId.systemDefault(),
            ),
        )
    },
)
