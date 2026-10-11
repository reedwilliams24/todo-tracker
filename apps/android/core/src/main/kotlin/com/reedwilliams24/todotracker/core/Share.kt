package com.reedwilliams24.todotracker.core

import java.io.ByteArrayOutputStream

/** Most todos one share can add (spec/features/share.md). */
const val MAX_SHARED_ITEMS = 50

private val LINE_BREAK = Regex("""\r?\n""")
private val JS_WHITESPACE =
    Regex("[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+")
private val SHARE_KEYS = listOf("add", "text", "title")

/**
 * Turns text shared from another app (or a `?add=` param) into drafts: one per non-empty line,
 * whitespace collapsed and trimmed, de-duplicated against each other and existing titles (case-insensitive).
 */
fun draftsFromSharedText(texts: List<String>, existing: List<Todo> = emptyList()): List<TodoDraft> {
    val seen = existing.mapTo(mutableSetOf()) { it.title.trim().lowercase() }
    val drafts = mutableListOf<TodoDraft>()
    for (text in texts) {
        for (line in text.split(LINE_BREAK)) {
            val title = line.replace(JS_WHITESPACE, " ").trim()
            val key = title.lowercase()
            if (!isValidTitle(title) || key in seen) continue
            seen += key
            drafts += TodoDraft(title = title)
            if (drafts.size >= MAX_SHARED_ITEMS) return drafts
        }
    }
    return drafts
}

/** `add` (repeatable), then `text`, then `title` values from a query string, decoded like `URLSearchParams`. */
fun sharedTextFromQuery(search: String): List<String> {
    val pairs = search.removePrefix("?").split('&').filter { it.isNotEmpty() }.map { part ->
        val eq = part.indexOf('=')
        if (eq < 0) formDecode(part) to "" else formDecode(part.substring(0, eq)) to formDecode(part.substring(eq + 1))
    }
    return SHARE_KEYS.flatMap { key -> pairs.filter { it.first == key }.map { it.second } }
}

/** application/x-www-form-urlencoded decoding: `+` is a space, malformed `%` escapes are kept. */
private fun formDecode(value: String): String {
    val bytes = value.toByteArray(Charsets.UTF_8)
    val out = ByteArrayOutputStream(bytes.size)
    var i = 0
    while (i < bytes.size) {
        val byte = bytes[i].toInt() and 0xFF
        val hi = if (i + 2 < bytes.size) hexValue(bytes[i + 1]) else -1
        val lo = if (i + 2 < bytes.size) hexValue(bytes[i + 2]) else -1
        if (byte == '%'.code && hi >= 0 && lo >= 0) {
            out.write(hi * 16 + lo)
            i += 3
        } else {
            out.write(if (byte == '+'.code) ' '.code else byte)
            i++
        }
    }
    return out.toByteArray().toString(Charsets.UTF_8)
}

private fun hexValue(byte: Byte): Int = when (val c = (byte.toInt() and 0xFF).toChar()) {
    in '0'..'9' -> c - '0'
    in 'a'..'f' -> c - 'a' + 10
    in 'A'..'F' -> c - 'A' + 10
    else -> -1
}
