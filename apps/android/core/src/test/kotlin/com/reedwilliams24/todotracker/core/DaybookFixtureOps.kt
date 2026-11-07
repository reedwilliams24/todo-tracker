package com.reedwilliams24.todotracker.core

import java.time.ZoneId
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/** `daybook` ops; mirrors packages/spec/src/features/daybook.ts. */
internal val daybookOps: Map<String, Op> =
    mapOf(
        "daybookSections" to
            { g: JsonObject ->
                val s = daybookSections(g.todos(), g["today"]!!.jsonPrimitive.content)
                buildJsonObject {
                    for ((key, list) in
                        listOf("slipped" to s.slipped, "today" to s.today, "later" to s.later, "done" to s.done)) {
                        putJsonArray(key) { list.forEach { add(it.id) } }
                    }
                }
            },
        "daybookProgress" to
            { g: JsonObject ->
                val p =
                    daybookProgress(
                        g.todos(),
                        g.instant("now"),
                        g["timeZone"]?.jsonPrimitive?.content?.let(ZoneId::of) ?: ZoneId.systemDefault(),
                    )
                buildJsonObject {
                    put("done", p.done)
                    put("total", p.total)
                }
            },
        "upcomingDays" to
            { g: JsonObject ->
                buildJsonArray {
                    for (day in upcomingDays(g.todos(), g["today"]!!.jsonPrimitive.content)) {
                        addJsonObject {
                            put("date", day.date)
                            putJsonArray("ids") { day.todos.forEach { add(it.id) } }
                        }
                    }
                }
            },
    )
