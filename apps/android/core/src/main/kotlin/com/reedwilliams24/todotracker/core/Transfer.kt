package com.reedwilliams24.todotracker.core

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.ZoneOffset

/** Port of packages/shared/src/transfer.ts; rules in spec/features/transfer.md. */
const val EXPORT_VERSION = 1

enum class ImportMode {
    MERGE, REPLACE;

    val key: String get() = name.lowercase()
}

enum class ExportFormat(val mimeType: String) {
    JSON("application/json"), CSV("text/csv");

    val key: String get() = name.lowercase()
}

data class ImportResult(val todos: List<Todo>, val errors: List<String>)

val CSV_COLUMNS = listOf("id", "title", "completed", "priority", "dueDate", "notes", "createdAt", "updatedAt")

private val TIMESTAMP_PATTERN = Regex("""^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,3})?Z$""")
private val PrettyJson = Json { prettyPrint = true }

/** UTC ISO-8601 like `2026-01-05T09:00:00.000Z` (milliseconds optional), with a real date and time. */
fun isValidTimestamp(value: String): Boolean {
    val match = TIMESTAMP_PATTERN.matchEntire(value) ?: return false
    val (date, hours, minutes, seconds) = match.destructured
    return isValidDueDate(date) && hours.toInt() < 24 && minutes.toInt() < 60 && seconds.toInt() < 60
}

fun exportTodosJson(todos: List<Todo>, now: Instant = Instant.now()): String = PrettyJson.encodeToString(
    JsonElement.serializer(),
    buildJsonObject {
        put("version", EXPORT_VERSION)
        put("exportedAt", timestamp(now))
        put("todos", TodoJson.encodeToJsonElement(ListSerializer(Todo.serializer()), todos))
    },
)

private fun csvCell(value: String?): String {
    val text = value.orEmpty()
    return if (text.any { it == '"' || it == ',' || it == '\n' || it == '\r' }) "\"${text.replace("\"", "\"\"")}\"" else text
}

fun exportTodosCsv(todos: List<Todo>): String {
    val rows = todos.map {
        listOf(it.id, it.title, it.completed.toString(), it.priority.key, it.dueDate, it.notes, it.createdAt, it.updatedAt)
            .joinToString(",", transform = ::csvCell)
    }
    return (listOf(CSV_COLUMNS.joinToString(",")) + rows).joinToString("\n")
}

/** `todos-YYYY-MM-DD.<format>`, dated in UTC. */
fun exportFileName(format: ExportFormat, now: Instant = Instant.now()): String =
    "todos-${now.atOffset(ZoneOffset.UTC).toLocalDate()}.${format.key}"

private fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
private fun JsonObject.isAbsent(key: String): Boolean = this[key] == null || this[key] is JsonNull

private fun validateTodo(value: JsonElement, index: Int): Pair<Todo?, String?> {
    val at = "Item ${index + 1}"
    if (value !is JsonObject) return null to "$at: not an object"
    val id = value.string("id")
    if (id.isNullOrEmpty()) return null to "$at: missing id"
    fun fail(problem: String) = null to "$at ($id): $problem"
    val title = value.string("title")
    if (title == null || !isValidTitle(title)) return fail("title must be 1-200 characters")
    val completed = (value["completed"] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
        ?: return fail("completed must be true/false")
    val priority = TodoPriority.entries.firstOrNull { it.key == value.string("priority") }
        ?: return fail("priority must be low, medium, or high")
    val dueDate = value.string("dueDate")
    if (!value.isAbsent("dueDate") && (dueDate == null || !isValidDueDate(dueDate))) return fail("dueDate must be YYYY-MM-DD")
    val notes = value.string("notes")
    if (!value.isAbsent("notes") && notes == null) return fail("notes must be text")
    val createdAt = value.string("createdAt")
    if (createdAt == null || !isValidTimestamp(createdAt)) return fail("invalid createdAt")
    val updatedAt = value.string("updatedAt")?.takeIf(::isValidTimestamp) ?: createdAt
    return Todo(
        id = id,
        title = title.trim(),
        notes = notes?.ifEmpty { null },
        completed = completed,
        priority = priority,
        dueDate = dueDate?.ifEmpty { null },
        createdAt = createdAt,
        updatedAt = updatedAt,
    ) to null
}

/** Accepts the `{ version, todos }` export envelope or a bare todo array; keeps valid items and reports the rest. */
fun parseImportJson(raw: String): ImportResult {
    val parsed = try {
        Json.parseToJsonElement(raw)
    } catch (_: Exception) {
        return ImportResult(emptyList(), listOf("File is not valid JSON"))
    }
    val list = when (parsed) {
        is JsonArray -> parsed
        is JsonObject -> parsed["todos"] as? JsonArray
        else -> null
    } ?: return ImportResult(emptyList(), listOf("Expected a list of todos"))

    val todos = mutableListOf<Todo>()
    val errors = mutableListOf<String>()
    val seen = mutableSetOf<String>()
    list.forEachIndexed { index, item ->
        val (todo, error) = validateTodo(item, index)
        when {
            todo == null -> errors += error!!
            !seen.add(todo.id) -> errors += "Item ${index + 1} (${todo.id}): duplicate id"
            else -> todos += todo
        }
    }
    return ImportResult(todos, errors)
}

/** merge: imported rows overwrite same-id rows in place, new ones are appended. replace: the imported list wins. */
fun applyImport(existing: List<Todo>, imported: List<Todo>, mode: ImportMode): List<Todo> {
    if (mode == ImportMode.REPLACE) return imported.toList()
    val byId = imported.associateBy { it.id }
    val known = existing.mapTo(HashSet()) { it.id }
    return existing.map { byId[it.id] ?: it } + imported.filter { it.id !in known }
}

private fun plural(count: Int, noun: String) = "$count ${if (count == 1) noun else "${noun}s"}"

/** Confirmation text, e.g. "Found 1 valid todo and 2 problems." */
fun describeImport(valid: Int, problems: Int): String =
    "Found $valid valid ${if (valid == 1) "todo" else "todos"}${if (problems > 0) " and ${plural(problems, "problem")}" else ""}."

/** Status after confirming, e.g. "Imported 3 todos (merge)." */
fun describeImported(count: Int, mode: ImportMode): String = "Imported ${plural(count, "todo")} (${mode.key})."
