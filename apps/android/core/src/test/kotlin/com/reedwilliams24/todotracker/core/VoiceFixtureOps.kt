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

/** `voice` ops; mirrors packages/spec/src/features/voice.ts. */
internal val voiceOps: Map<String, Op> = mapOf(
    "parseTranscript" to { g: JsonObject -> encodeDrafts(parseTranscript(g.str("transcript"), g.local("now"))) },
    "extractPriority" to { g: JsonObject -> TodoJson.encodeToJsonElement(PriorityMatch.serializer(), extractPriority(g.str("text"))) },
    "extractDueDate" to { g: JsonObject -> TodoJson.encodeToJsonElement(DueDateMatch.serializer(), extractDueDate(g.str("text"), g.local("now"))) },
    "cleanTitle" to { g: JsonObject -> JsonPrimitive(cleanTitle(g.str("text"))) },
    "coerceDrafts" to { g: JsonObject -> encodeDrafts(coerceDrafts(g["value"])) },
    "reconcileDrafts" to { g: JsonObject -> encodeDrafts(reconcileDrafts(g.drafts("heuristic"), g.drafts("llm"))) },
)
