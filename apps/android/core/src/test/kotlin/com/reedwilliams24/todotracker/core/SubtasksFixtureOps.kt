package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** `subtasks` ops; mirrors packages/spec/src/features/subtasks.ts. */
internal val subtasksOps: Map<String, Op> =
    mapOf(
        "subtaskProgress" to
            { g: JsonObject ->
                subtaskProgress(g.todo()).let {
                    buildJsonObject {
                        put("done", it.done)
                        put("total", it.total)
                    }
                }
            },
        "addSubtask" to { g: JsonObject -> encode(addSubtask(g.todo(), g.str("title"), g.instant("now"))) },
        "toggleSubtask" to { g: JsonObject -> encode(toggleSubtask(g.todo(), g.str("subtaskId"), g.instant("now"))) },
        "removeSubtask" to { g: JsonObject -> encode(removeSubtask(g.todo(), g.str("subtaskId"), g.instant("now"))) },
    )

private fun JsonObject.todo(): Todo = TodoJson.decodeFromJsonElement(Todo.serializer(), getValue("todo"))

private fun encode(todo: Todo): JsonElement = TodoJson.encodeToJsonElement(Todo.serializer(), todo)
