package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** `storage` ops; mirrors packages/spec/src/features/storage.ts. */
internal val storageOps: Map<String, Op> =
    mapOf(
        "parseStoredTodos" to
            { g: JsonObject ->
                encode(parseStoredTodos((g["raw"] as? JsonPrimitive)?.takeIf { it.isString }?.content))
            },
        "serializeTodos" to { g: JsonObject -> Json.parseToJsonElement(serializeTodos(g.todos())) },
    )
