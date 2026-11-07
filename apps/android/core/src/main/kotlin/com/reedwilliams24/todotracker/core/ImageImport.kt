package com.reedwilliams24.todotracker.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Image → todos (spec/features/image-import.md). */
@Serializable
data class ImageImportConstants(
    val acceptedTypes: List<String>,
    val maxBytes: Int,
    val maxDimension: Int,
    val jpegQuality: Double,
    val maxTodos: Int,
)

val IMAGE_IMPORT =
    ImageImportConstants(
        acceptedTypes = listOf("image/heic", "image/heif", "image/jpeg", "image/png", "image/webp"),
        maxBytes = 3_000_000,
        maxDimension = 2048,
        jpegQuality = 0.85,
        maxTodos = 50,
    )

/** Error codes shown as `image.error.<key>`. */
enum class ImageImportError(val key: String) {
    BUSY("busy"),
    FAILED("failed"),
    INVALID("invalid"),
    OFFLINE("offline"),
    TOO_LARGE("tooLarge"),
    UNAVAILABLE("unavailable"),
    UNSUPPORTED("unsupported"),
}

/** Validates an image before it is sent: `ok`, `invalid`, `tooLarge` or `unsupported`. */
fun checkImageUpload(mimeType: String, bytes: Long): String =
    when {
        mimeType.lowercase() !in IMAGE_IMPORT.acceptedTypes -> "unsupported"
        bytes <= 0 -> "invalid"
        bytes > IMAGE_IMPORT.maxBytes -> "tooLarge"
        else -> "ok"
    }

/** Maps a failed `/api/image-todos` response to the error the client shows. */
fun imageImportErrorFor(status: Int, body: JsonElement?): ImageImportError {
    val code = ((body as? JsonObject)?.get("error") as? JsonPrimitive)?.takeIf { it.isString }?.content
    ImageImportError.entries
        .firstOrNull { it.key == code }
        ?.let {
            return it
        }
    return when (status) {
        400 -> ImageImportError.INVALID
        413 -> ImageImportError.TOO_LARGE
        415 -> ImageImportError.UNSUPPORTED
        429 -> ImageImportError.BUSY
        503 -> ImageImportError.UNAVAILABLE
        else -> ImageImportError.FAILED
    }
}

private val BULLET = Regex("""^(?:[-*•◦▪·]|\[ ?]|☐|\d{1,3}[.)])\s+""")
private val WHITESPACE = Regex("""\s+""")
private val CALENDAR_DATE = Regex("""^(\d{4})-(\d{2})-(\d{2})$""")

private fun collapse(text: String): String = text.replace(WHITESPACE, " ").trim()

private fun isCalendarDate(value: String): Boolean {
    val match = CALENDAR_DATE.matchEntire(value) ?: return false
    val (year, month, day) = match.destructured.toList().map { it.toInt() }
    if (month !in 1..12 || day < 1) return false
    val leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
    val days = intArrayOf(31, if (leap) 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)[month - 1]
    return day <= days
}

/**
 * Validates untrusted model output for an image into drafts: keeps the model's wording, strips list bullets, drops
 * invalid fields and duplicate titles, and caps the count.
 */
fun coerceImageDrafts(value: JsonElement?): List<TodoDraft> {
    val items: List<JsonElement> =
        when {
            value is JsonArray -> value
            value is JsonObject && value["todos"] is JsonArray -> value["todos"] as JsonArray
            else -> emptyList()
        }
    val drafts = mutableListOf<TodoDraft>()
    val seen = mutableSetOf<String>()
    for (item in items) {
        if (drafts.size >= IMAGE_IMPORT.maxTodos) break
        val fields: Map<String, JsonElement> =
            when {
                item is JsonPrimitive && item.isString -> mapOf("title" to item)
                item is JsonObject -> item
                else -> continue
            }
        val title = fields["title"].stringValue() ?: continue
        val cleaned = collapse(collapse(title).replace(BULLET, ""))
        if (!isValidTitle(cleaned)) continue
        val key = cleaned.lowercase()
        if (!seen.add(key)) continue
        val note = fields["notes"].stringValue()?.trim().orEmpty()
        drafts +=
            TodoDraft(
                title = cleaned,
                notes = note.takeIf { it.isNotEmpty() && it.lowercase() != key },
                priority = TodoPriority.entries.firstOrNull { it.key == fields["priority"].stringValue() },
                dueDate = fields["dueDate"].stringValue()?.takeIf(::isCalendarDate),
            )
    }
    return drafts
}

private fun JsonElement?.stringValue(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
