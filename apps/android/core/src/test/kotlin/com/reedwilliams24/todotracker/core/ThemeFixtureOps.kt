package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** `theme` ops; mirrors packages/spec/src/features/theme.ts. */
internal val themeOps: Map<String, Op> =
    mapOf(
        "themeConstants" to
            { _: JsonObject ->
                buildJsonObject {
                    put("storageKey", THEME_STORAGE_KEY)
                    put("defaultTheme", DEFAULT_THEME.key)
                    put("preferences", JsonArray(THEME_PREFERENCES.map { JsonPrimitive(it.key) }))
                    put("labels", buildJsonObject { THEME_PREFERENCES.forEach { put(it.key, it.label) } })
                }
            },
        "parseThemePreference" to
            { g: JsonObject ->
                JsonPrimitive(parseThemePreference((g["raw"] as? JsonPrimitive)?.takeIf { it.isString }?.content).key)
            },
        "resolveTheme" to
            { g: JsonObject ->
                JsonPrimitive(
                    resolveTheme(
                            parseThemePreference(g.str("preference")),
                            g.getValue("systemDark").jsonPrimitive.boolean,
                        )
                        .key
                )
            },
        "nextThemePreference" to
            { g: JsonObject ->
                JsonPrimitive(nextThemePreference(parseThemePreference(g.str("preference"))).key)
            },
    )
