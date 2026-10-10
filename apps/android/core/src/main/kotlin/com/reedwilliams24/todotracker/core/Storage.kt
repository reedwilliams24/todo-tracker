package com.reedwilliams24.todotracker.core

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement

const val STORAGE_KEY = "todo-tracker:todos:v1"

val TodoJson = Json {
    explicitNulls = false
    ignoreUnknownKeys = true
}

fun serializeTodos(todos: List<Todo>): String = TodoJson.encodeToString(ListSerializer(Todo.serializer()), todos)

/** Missing, empty, corrupt or non-array values load as an empty list. */
fun parseStoredTodos(raw: String?): List<Todo> {
    if (raw.isNullOrEmpty()) return emptyList()
    val parsed: JsonElement = try {
        TodoJson.parseToJsonElement(raw)
    } catch (_: Exception) {
        return emptyList()
    }
    if (parsed !is JsonArray) return emptyList()
    return parsed.mapNotNull { runCatching { TodoJson.decodeFromJsonElement(Todo.serializer(), it) }.getOrNull() }
}
