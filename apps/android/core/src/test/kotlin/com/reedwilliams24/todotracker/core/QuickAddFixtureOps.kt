package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** `quick-add` ops; mirrors packages/spec/src/features/quick-add.ts. */
internal val quickAddOps: Map<String, Op> =
    mapOf(
        "parseQuickAdd" to
            { g: JsonObject ->
                TodoJson.encodeToJsonElement(QuickAddParse.serializer(), parseQuickAdd(g.str("input"), g.local("now")))
            },
        "hasQuickAddMeta" to { g: JsonObject -> JsonPrimitive(hasQuickAddMeta(g.quickAddParse())) },
        "quickAddToDraft" to
            { g: JsonObject ->
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
