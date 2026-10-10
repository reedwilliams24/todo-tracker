package com.reedwilliams24.todotracker.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.LocalDate
import java.time.LocalDateTime

// Port of packages/shared/src/voice.ts. JS `String.replace(regex)` without /g replaces only the
// first match, hence replaceFirst below.

private val I = setOf(RegexOption.IGNORE_CASE)

private val SEPARATOR =
    Regex("""\s*(?:\band then\b|\bafter that\b|\balso\b|\band also\b|[;\n]|,\s*(?=and\s)|\.\s+)\s*""", I)

private val PRIORITY_PATTERNS: List<Pair<Regex, TodoPriority>> = listOf(
    Regex("""\b(urgent(ly)?|asap|critical|high priority|important)\b""", I) to TodoPriority.HIGH,
    Regex("""\b(low priority|whenever|no rush|someday|eventually)\b""", I) to TodoPriority.LOW,
    Regex("""\b(medium priority|normal priority)\b""", I) to TodoPriority.MEDIUM,
)

private val WEEKDAYS = listOf("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")

private val LEADING_FILLER = Regex(
    """^(?:(?:um|uh|ok|okay|so|hey|please|remind me to|i need to|i have to|i want to|remember to|add (?:a )?(?:todo|task|item)(?: to| for)?|create (?:a )?(?:todo|task)(?: to| for)?|make (?:a )?note to|let's|lets)(?:[\s,.!?]+|$))+""",
    I,
)
private val LEADING_PUNCTUATION = Regex("""^[\s.,!?]+""")
private val TRAILING_FILLER = Regex("""[\s.,!?]+$""")
private val WHITESPACE = Regex("""\s+""")
private val ISO_DATE = Regex("""^\d{4}-\d{2}-\d{2}$""")

@Serializable
data class PriorityMatch(val priority: TodoPriority? = null, val rest: String)

@Serializable
data class DueDateMatch(val dueDate: String? = null, val rest: String)

private fun toIsoDate(date: LocalDate): String = date.toString()

fun extractPriority(text: String): PriorityMatch {
    for ((pattern, priority) in PRIORITY_PATTERNS) {
        if (pattern.containsMatchIn(text)) return PriorityMatch(priority, pattern.replaceFirst(text, " "))
    }
    return PriorityMatch(rest = text)
}

/** `now` is device-local time; relative dates resolve against its calendar date. */
fun extractDueDate(text: String, now: LocalDateTime = LocalDateTime.now()): DueDateMatch {
    val today = now.toLocalDate()
    val relative = listOf(
        Regex("""\btoday\b""", I) to 0L,
        Regex("""\btonight\b""", I) to 0L,
        Regex("""\btomorrow\b""", I) to 1L,
        Regex("""\bnext week\b""", I) to 7L,
    )
    for ((pattern, days) in relative) {
        if (pattern.containsMatchIn(text)) return DueDateMatch(toIsoDate(today.plusDays(days)), pattern.replaceFirst(text, " "))
    }

    val currentDay = today.dayOfWeek.value % 7 // JS getDay(): Sunday = 0
    for ((index, weekday) in WEEKDAYS.withIndex()) {
        val pattern = Regex("""\b(?:on|by|next)?\s*$weekday\b""", I)
        if (pattern.containsMatchIn(text)) {
            val delta = ((index - currentDay + 7) % 7).let { if (it == 0) 7 else it }
            return DueDateMatch(toIsoDate(today.plusDays(delta.toLong())), pattern.replaceFirst(text, " "))
        }
    }

    return DueDateMatch(rest = text)
}

fun cleanTitle(text: String): String {
    var result = LEADING_PUNCTUATION.replaceFirst(text, "")
    result = LEADING_FILLER.replaceFirst(result, "")
    result = WHITESPACE.replace(result, " ")
    result = TRAILING_FILLER.replaceFirst(result, "")
    return result.trim()
}

/** Splits a spoken transcript into todo drafts without an LLM. */
fun parseTranscript(transcript: String, now: LocalDateTime = LocalDateTime.now()): List<TodoDraft> =
    transcript.split(SEPARATOR)
        .map { segment ->
            val withoutPriority = extractPriority(segment)
            val withoutDueDate = extractDueDate(withoutPriority.rest, now)
            TodoDraft(
                title = cleanTitle(withoutDueDate.rest),
                priority = withoutPriority.priority,
                dueDate = withoutDueDate.dueDate,
            )
        }
        .filter { isValidTitle(it.title) }

private val STOPWORDS = setOf("a", "an", "and", "for", "my", "me", "the", "to", "up", "with")
private val NON_WORD = Regex("[^a-z0-9]+")

private fun contentWords(title: String): Set<String> =
    title.lowercase().split(NON_WORD).filter { it.length > 1 && it !in STOPWORDS }.toSet()

private fun describesSameTask(a: String, b: String): Boolean {
    val left = contentWords(a)
    return contentWords(b).any { it in left }
}

/** Keeps the model's drafts but recovers tasks it dropped from the regex parse. */
fun reconcileDrafts(heuristic: List<TodoDraft>, llm: List<TodoDraft>): List<TodoDraft> {
    if (llm.isEmpty()) return heuristic
    // Track by index: JS uses a Set of object identities, so equal-valued drafts stay distinct.
    val unmatched = LinkedHashSet(llm.indices.toList())
    val merged = heuristic.map { draft ->
        val match = unmatched.firstOrNull { describesSameTask(llm[it].title, draft.title) }
        if (match != null) {
            unmatched.remove(match)
            llm[match]
        } else {
            draft
        }
    }
    return merged + llm.indices.filter { it in unmatched }.map { llm[it] }
}

/** Validates untrusted model output (`{todos: [...]}` or a bare array) into drafts. */
fun coerceDrafts(value: JsonElement?): List<TodoDraft> {
    val items: List<JsonElement> = when {
        value is JsonArray -> value
        value is JsonObject && value["todos"] is JsonArray -> value["todos"] as JsonArray
        else -> emptyList()
    }
    return items.mapNotNull { item ->
        val fields: Map<String, JsonElement> = when {
            item is JsonPrimitive && item.isString -> mapOf("title" to item)
            item is JsonObject -> item
            else -> return@mapNotNull null
        }
        val title = fields["title"].stringOrNull() ?: return@mapNotNull null
        val cleaned = cleanTitle(title)
        if (!isValidTitle(cleaned)) return@mapNotNull null
        TodoDraft(
            title = cleaned,
            priority = TodoPriority.entries.firstOrNull { it.key == fields["priority"].stringOrNull() },
            dueDate = fields["dueDate"].stringOrNull()?.takeIf { ISO_DATE.matches(it) },
        )
    }
}

private fun JsonElement?.stringOrNull(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
