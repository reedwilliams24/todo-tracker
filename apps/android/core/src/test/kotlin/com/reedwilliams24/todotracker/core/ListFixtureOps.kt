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

/** `list` ops; mirrors packages/spec/src/features/list.ts. */
internal val listOps: Map<String, Op> = mapOf(
    "filterTodos" to { g: JsonObject -> encode(filterTodos(g.todos(), TodoFilter.fromKey(g.str("filter")))) },
    "searchTodos" to { g: JsonObject -> encode(searchTodos(g.todos(), g.str("query"))) },
    "sortByPriority" to { g: JsonObject -> encode(sortByPriority(g.todos())) },
    "sortByDue" to { g: JsonObject -> encode(sortByDue(g.todos())) },
    "sortTodos" to { g: JsonObject -> encode(sortTodos(g.todos(), g["sort"]?.jsonPrimitive?.content?.let(TodoSort::fromKey) ?: TodoSort.PRIORITY)) },
    "countRemaining" to { g: JsonObject -> JsonPrimitive(countRemaining(g.todos())) },
    "countCompleted" to { g: JsonObject -> JsonPrimitive(countCompleted(g.todos())) },
    "addTodos" to { g: JsonObject ->
        addTodos(g.todos(), g.drafts("drafts"), g.instant("now")).let {
            buildJsonObject {
                put("todos", encode(it.todos))
                put("created", encode(it.created))
            }
        }
    },
    "toggleInList" to { g: JsonObject -> encode(toggleInList(g.todos(), g.str("id"), g.instant("now"))) },
    "removeFromList" to { g: JsonObject -> encode(removeFromList(g.todos(), g.getValue("ids").jsonArray.map { it.jsonPrimitive.content })) },
    "clearCompletedInList" to { g: JsonObject -> encode(clearCompletedInList(g.todos())) },
    "bulkToggle" to { g: JsonObject -> encode(bulkToggle(g.todos(), g.getValue("ids").jsonArray.map { it.jsonPrimitive.content }, g.instant("now"))) },
)
