package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

private fun JsonObject.strings(key: String): List<String> = getValue(key).jsonArray.map { it.jsonPrimitive.content }
private fun JsonObject.params(): Map<String, Any> = (get("params") as? JsonObject).orEmpty().mapValues { (_, value) ->
    val p = value.jsonPrimitive
    if (p.isString) p.content else p.content.toLongOrNull() ?: p.content.toDouble()
}

/** `localization` ops; mirrors packages/spec/src/features/localization.ts. */
internal val localizationOps: Map<String, Op> = mapOf(
    "messages" to { _: JsonObject -> JsonObject(EN_MESSAGES.mapValues { JsonPrimitive(it.value) }) },
    "resolveLocale" to { g: JsonObject ->
        JsonPrimitive(resolveLocale(g.strings("preferred"), if (g.containsKey("supported")) g.strings("supported") else CATALOGS.keys.toList()))
    },
    "formatMessage" to { g: JsonObject -> JsonPrimitive(formatMessage(g.str("locale"), g.str("message"), g.params())) },
    "translate" to { g: JsonObject -> JsonPrimitive(Translator(g.str("locale"))(g.str("key"), g.params())) },
)
