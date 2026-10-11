package com.reedwilliams24.todotracker.core

import java.time.format.DateTimeFormatter
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** `reminders` ops; mirrors packages/spec/src/features/reminders.ts. */
internal val remindersOps: Map<String, Op> =
    mapOf(
        "remindersConstants" to
            { _: JsonObject ->
                buildJsonObject {
                    put("reminderOffsets", JsonArray(REMINDER_OFFSETS.map { JsonPrimitive(it.key) }))
                    put("reminderLabels", buildJsonObject { REMINDER_OFFSETS.forEach { put(it.key, it.label) } })
                    put("dueHour", DUE_HOUR)
                }
            },
        "reminderAt" to
            { g: JsonObject ->
                reminderAt(g.reminderTodo())?.let { JsonPrimitive(LOCAL_TIME.format(it)) } ?: JsonNull
            },
        "describeReminder" to { g: JsonObject -> JsonPrimitive(describeReminder(g.reminderTodo())) },
        "planReminders" to { g: JsonObject -> encodeReminders(planReminders(g.todos())) },
        "dueReminders" to
            { g: JsonObject ->
                encodeReminders(dueReminders(g.todos(), g.strings("delivered").toSet(), g.local("now")))
            },
        "pruneDelivered" to
            { g: JsonObject ->
                JsonArray(pruneDelivered(g.strings("delivered").toSet(), g.todos()).sorted().map(::JsonPrimitive))
            },
    )

private val LOCAL_TIME = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss")

private fun JsonObject.reminderTodo(): Todo = TodoJson.decodeFromJsonElement(Todo.serializer(), getValue("todo"))

private fun encodeReminders(reminders: List<Reminder>): JsonElement =
    JsonArray(
        reminders.map {
            buildJsonObject {
                put("key", it.key)
                put("todoId", it.todoId)
                put("title", it.title)
                put("body", it.body)
                put("at", LOCAL_TIME.format(it.at))
            }
        }
    )
