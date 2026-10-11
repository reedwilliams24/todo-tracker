package com.reedwilliams24.todotracker.core

import java.time.ZoneId
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** `stats` ops; mirrors packages/spec/src/features/stats.ts. */
internal val statsOps: Map<String, Op> =
    mapOf(
        "statsConstants" to { _: JsonObject -> buildJsonObject { put("statsDays", STATS_DAYS) } },
        "computeStats" to
            { g: JsonObject ->
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
