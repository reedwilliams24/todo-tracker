package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** `voice` ops; mirrors packages/spec/src/features/voice.ts. */
internal val voiceOps: Map<String, Op> =
    mapOf(
        "parseTranscript" to { g: JsonObject -> encodeDrafts(parseTranscript(g.str("transcript"), g.local("now"))) },
        "extractPriority" to
            { g: JsonObject ->
                TodoJson.encodeToJsonElement(PriorityMatch.serializer(), extractPriority(g.str("text")))
            },
        "extractDueDate" to
            { g: JsonObject ->
                TodoJson.encodeToJsonElement(DueDateMatch.serializer(), extractDueDate(g.str("text"), g.local("now")))
            },
        "cleanTitle" to { g: JsonObject -> JsonPrimitive(cleanTitle(g.str("text"))) },
        "coerceDrafts" to { g: JsonObject -> encodeDrafts(coerceDrafts(g["value"])) },
        "reconcileDrafts" to { g: JsonObject -> encodeDrafts(reconcileDrafts(g.drafts("heuristic"), g.drafts("llm"))) },
    )
