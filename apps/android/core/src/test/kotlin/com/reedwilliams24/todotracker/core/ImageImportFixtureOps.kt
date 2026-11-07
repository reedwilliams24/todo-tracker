package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long

/** `image-import` ops; mirrors packages/spec/src/features/image-import.ts. */
internal val imageImportOps: Map<String, Op> =
    mapOf(
        "checkImageUpload" to
            { g: JsonObject ->
                JsonPrimitive(checkImageUpload(g.str("mimeType"), g.getValue("bytes").jsonPrimitive.long))
            },
        "coerceImageDrafts" to { g: JsonObject -> encodeDrafts(coerceImageDrafts(g["value"])) },
        "imageImportConstants" to
            { _: JsonObject ->
                TodoJson.encodeToJsonElement(ImageImportConstants.serializer(), IMAGE_IMPORT)
            },
        "imageImportErrorFor" to
            { g: JsonObject ->
                JsonPrimitive(imageImportErrorFor(g.getValue("status").jsonPrimitive.int, g["body"]).key)
            },
    )
