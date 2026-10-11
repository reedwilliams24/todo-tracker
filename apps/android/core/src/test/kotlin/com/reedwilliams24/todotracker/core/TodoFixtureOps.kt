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

/** `todo` ops; mirrors packages/spec/src/features/todo.ts. */
internal val todoOps: Map<String, Op> = mapOf(
    "constants" to { _: JsonObject ->
        buildJsonObject {
            put("storageKey", STORAGE_KEY)
            put("undoTimeoutMs", UNDO_TIMEOUT_MS)
            put("defaultPriority", DEFAULT_PRIORITY.key)
            put("priorityOrder", buildJsonObject { PRIORITY_ORDER.forEach { (p, n) -> put(p.key, n) } })
            put("emptyForm", Json { encodeDefaults = true }.encodeToJsonElement(TodoFormState.serializer(), EMPTY_TODO_FORM))
        }
    },
    "isValidTitle" to { g: JsonObject -> JsonPrimitive(isValidTitle(g.str("title"))) },
    "isValidDueDate" to { g: JsonObject -> JsonPrimitive(isValidDueDate(g.str("value"))) },
    "toTodoDraft" to { g: JsonObject ->
        TodoJson.encodeToJsonElement(
            TodoDraft.serializer(),
            toTodoDraft(TodoJson.decodeFromJsonElement(TodoFormState.serializer(), g.getValue("form"))),
        )
    },
    "createTodo" to { g: JsonObject ->
        TodoJson.encodeToJsonElement(
            Todo.serializer(),
            createTodo(TodoJson.decodeFromJsonElement(TodoDraft.serializer(), g.getValue("draft")), g.instant("now")),
        )
    },
    "updateTodoText" to { g: JsonObject -> encode(updateTodoText(g.todos(), g.str("id"), g.str("text"), g.instant("now"))) },
    "toggleTodo" to { g: JsonObject ->
        TodoJson.encodeToJsonElement(
            Todo.serializer(),
            toggleTodo(TodoJson.decodeFromJsonElement(Todo.serializer(), g.getValue("todo")), g.instant("now")),
        )
    },
    "isOverdue" to { g: JsonObject ->
        JsonPrimitive(
            isOverdue(TodoJson.decodeFromJsonElement(Todo.serializer(), g.getValue("todo")), g.local("now")),
        )
    },
    "toDateKey" to { g: JsonObject -> JsonPrimitive(toDateKey(g.local("now"))) },
)
