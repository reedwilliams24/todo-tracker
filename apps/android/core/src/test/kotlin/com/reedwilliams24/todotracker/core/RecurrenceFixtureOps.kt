package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** `recurrence` ops; mirrors packages/spec/src/features/recurrence.ts. */
internal val recurrenceOps: Map<String, Op> =
    mapOf(
        "recurrenceConstants" to
            { _: JsonObject ->
                buildJsonObject { put("recurrences", JsonArray(RECURRENCES.map { JsonPrimitive(it.key) })) }
            },
        "nextOccurrence" to
            { g: JsonObject ->
                JsonPrimitive(nextOccurrence(g.str("dueDate"), requireNotNull(Recurrence.fromKey(g.str("recurrence")))))
            },
        "scheduleNext" to
            { g: JsonObject ->
                scheduleNext(TodoJson.decodeFromJsonElement(Todo.serializer(), g.getValue("todo")), g.instant("now"))
                    ?.let { TodoJson.encodeToJsonElement(Todo.serializer(), it) } ?: JsonNull
            },
    )
