package com.reedwilliams24.todotracker.core

import kotlinx.serialization.Serializable
import java.time.LocalDateTime

// Port of apps/web/src/domain/quick-add.ts (spec/features/quick-add.md).

@Serializable
data class QuickAddParse(
    val title: String,
    val priority: TodoPriority? = null,
    val dueDate: String? = null,
    val tags: List<String>,
)

private val TAG = Regex("""(^|\s)#([\p{L}\p{N}_-]+)""")
private val BANG_PRIORITY = Regex("""(^|\s)!(p[123]|high|med(?:ium)?|low)\b""", RegexOption.IGNORE_CASE)
private val ISO_DATE = Regex("""(^|\s)(?:on |by |due )?(\d{4}-\d{2}-\d{2})\b""", RegexOption.IGNORE_CASE)
private val IN_DAYS = Regex("""\bin (\d{1,3}) days?\b""", RegexOption.IGNORE_CASE)

private val BANG_MAP = mapOf(
    "p1" to TodoPriority.HIGH,
    "p2" to TodoPriority.MEDIUM,
    "p3" to TodoPriority.LOW,
    "high" to TodoPriority.HIGH,
    "med" to TodoPriority.MEDIUM,
    "medium" to TodoPriority.MEDIUM,
    "low" to TodoPriority.LOW,
)

/**
 * Parses quick-add shorthand such as `call mom tomorrow 5pm #family !p1`: `#tag` -> tags,
 * `!p1`/`!high` -> priority, natural dates -> dueDate. `now` is device-local time.
 */
fun parseQuickAdd(input: String, now: LocalDateTime = LocalDateTime.now()): QuickAddParse {
    val tags = mutableListOf<String>()
    var rest = TAG.replace(input) { match ->
        val tag = match.groupValues[2].lowercase()
        if (tag !in tags) tags.add(tag)
        match.groupValues[1]
    }

    val priority: TodoPriority?
    val bang = BANG_PRIORITY.find(rest)
    if (bang != null) {
        priority = BANG_MAP.getValue(bang.groupValues[2].lowercase())
        rest = BANG_PRIORITY.replaceFirst(rest, " ")
    } else {
        val spoken = extractPriority(rest)
        priority = spoken.priority
        rest = spoken.rest
    }

    val dueDate: String?
    val iso = ISO_DATE.find(rest)
    val inDays = IN_DAYS.find(rest)
    if (iso != null && isValidDueDate(iso.groupValues[2])) {
        dueDate = iso.groupValues[2]
        rest = ISO_DATE.replaceFirst(rest, " ")
    } else if (inDays != null) {
        dueDate = now.toLocalDate().plusDays(inDays.groupValues[1].toLong()).toString()
        rest = IN_DAYS.replaceFirst(rest, " ")
    } else {
        val spoken = extractDueDate(rest, now)
        dueDate = spoken.dueDate
        rest = spoken.rest
    }

    return QuickAddParse(title = cleanTitle(rest), priority = priority, dueDate = dueDate, tags = tags)
}

/** True when the input contains any shorthand worth previewing. */
fun hasQuickAddMeta(parse: QuickAddParse): Boolean =
    parse.priority != null || parse.dueDate != null || parse.tags.isNotEmpty()

fun quickAddToDraft(parse: QuickAddParse, fallbackPriority: TodoPriority, fallbackDueDate: String? = null): TodoDraft =
    TodoDraft(
        title = parse.title,
        priority = parse.priority ?: fallbackPriority,
        dueDate = parse.dueDate ?: fallbackDueDate?.ifEmpty { null },
    )
