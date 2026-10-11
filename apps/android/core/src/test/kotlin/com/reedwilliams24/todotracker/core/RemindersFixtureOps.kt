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
import java.time.format.DateTimeFormatter

/** `reminders` ops; mirrors packages/spec/src/features/reminders.ts. */
internal val remindersOps: Map<String, Op> = mapOf(
    "remindersConstants" to { _: JsonObject ->
        buildJsonObject {
            put("reminderOffsets", JsonArray(REMINDER_OFFSETS.map { JsonPrimitive(it.key) }))
            put("reminderLabels", buildJsonObject { REMINDER_OFFSETS.forEach { put(it.key, it.label) } })
            put("dueHour", DUE_HOUR)
        }
    },
    "reminderAt" to { g: JsonObject -> reminderAt(g.reminderTodo())?.let { JsonPrimitive(LOCAL_TIME.format(it)) } ?: JsonNull },
    "describeReminder" to { g: JsonObject -> JsonPrimitive(describeReminder(g.reminderTodo())) },
    "planReminders" to { g: JsonObject -> encodeReminders(planReminders(g.todos())) },
    "dueReminders" to { g: JsonObject -> encodeReminders(dueReminders(g.todos(), g.strings("delivered"), g.local("now"))) },
    "pruneDelivered" to { g: JsonObject -> JsonArray(pruneDelivered(g.strings("delivered"), g.todos()).sorted().map(::JsonPrimitive)) },
)

private val LOCAL_TIME = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss")

private fun JsonObject.reminderTodo(): Todo = TodoJson.decodeFromJsonElement(Todo.serializer(), getValue("todo"))

private fun JsonObject.strings(key: String): Set<String> = getValue(key).jsonArray.mapTo(LinkedHashSet()) { it.jsonPrimitive.content }

private fun encodeReminders(reminders: List<Reminder>): JsonElement = JsonArray(reminders.map {
    buildJsonObject {
        put("key", it.key)
        put("todoId", it.todoId)
        put("title", it.title)
        put("body", it.body)
        put("at", LOCAL_TIME.format(it.at))
    }
})
