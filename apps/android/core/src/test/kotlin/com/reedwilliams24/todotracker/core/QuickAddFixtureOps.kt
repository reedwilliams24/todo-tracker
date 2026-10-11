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

/** `quick-add` ops; mirrors packages/spec/src/features/quick-add.ts. */
internal val quickAddOps: Map<String, Op> = mapOf(
    "parseQuickAdd" to { g: JsonObject -> TodoJson.encodeToJsonElement(QuickAddParse.serializer(), parseQuickAdd(g.str("input"), g.local("now"))) },
    "hasQuickAddMeta" to { g: JsonObject -> JsonPrimitive(hasQuickAddMeta(g.quickAddParse())) },
    "quickAddToDraft" to { g: JsonObject ->
        TodoJson.encodeToJsonElement(
            TodoDraft.serializer(),
            quickAddToDraft(
                g.quickAddParse(),
                TodoJson.decodeFromJsonElement(TodoPriority.serializer(), g.getValue("fallbackPriority")),
                (g["fallbackDueDate"] as? JsonPrimitive)?.content,
            ),
        )
    },
)
