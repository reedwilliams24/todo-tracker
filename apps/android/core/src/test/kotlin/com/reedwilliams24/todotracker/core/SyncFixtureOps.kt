package com.reedwilliams24.todotracker.core

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.long

/** `sync` ops; mirrors packages/spec/src/features/sync.ts. */
internal val syncOps: Map<String, Op> =
    mapOf(
        "syncConstants" to
            { _: JsonObject ->
                buildJsonObject { put("columns", JsonArray(SYNC_COLUMNS.map(::JsonPrimitive))) }
            },
        "toRow" to
            { g: JsonObject ->
                val deletedAt = g["deletedAt"]?.takeIf { it != JsonNull }?.let { g.instant("deletedAt") }
                rowJson(toRow(g.todo(), g.str("userId"), deletedAt))
            },
        "fromRow" to
            { g: JsonObject ->
                TodoJson.encodeToJsonElement(
                    Todo.serializer(),
                    fromRow(RowJson.decodeFromJsonElement(TodoRow.serializer(), g.getValue("row"))),
                )
            },
        "applyRemote" to
            { g: JsonObject ->
                encode(applyRemote(g.todos("local"), g.todos("inFlight"), g.rows(), g.cursor()))
            },
        "advanceCursor" to { g: JsonObject -> JsonPrimitive(advanceCursor(g.cursor(), g.rows())) },
        "rollbackPush" to
            { g: JsonObject ->
                encode(rollbackPush(g.todos("local"), g.todos("before"), g.strings("failedIds")))
            },
        "guestToRows" to
            { g: JsonObject ->
                JsonArray(guestToRows(g.todos("guest"), g.str("userId"), g.instant("now")).map(::rowJson))
            },
    )

private val rowList = ListSerializer(TodoRow.serializer())

private fun JsonObject.todo(): Todo = TodoJson.decodeFromJsonElement(Todo.serializer(), getValue("todo"))

private fun JsonObject.rows(): List<TodoRow> = RowJson.decodeFromJsonElement(rowList, getValue("rows"))

private fun JsonObject.cursor(): Long = (getValue("cursor") as JsonPrimitive).long

/** Fixtures can't hold null values (spec/README.md#normalization), so rows list their null columns separately. */
private fun rowJson(row: TodoRow): JsonElement {
    val fields = RowJson.encodeToJsonElement(TodoRow.serializer(), row).jsonObject
    return buildJsonObject {
        put("row", JsonObject(fields.filterValues { it != JsonNull }))
        put("nulls", JsonArray(fields.filterValues { it == JsonNull }.keys.sorted().map(::JsonPrimitive)))
    }
}
