package com.reedwilliams24.todotracker.core

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicContainer
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.io.File
import java.time.Instant
import java.time.LocalDateTime

/** Runs every case in spec/fixtures against the Kotlin implementation (see spec/README.md). */
class FixtureTest {
    private val fixtureDir: File = File(requireNotNull(javaClass.classLoader.getResource("todo.json")).toURI()).parentFile

    @TestFactory
    fun fixtures(): List<DynamicContainer> {
        val files = fixtureDir.listFiles { f -> f.extension == "json" }!!.sortedBy { it.name }
        assertTrue(files.isNotEmpty(), "no fixture files found in $fixtureDir")
        return files.map { file ->
            val cases = Json.parseToJsonElement(file.readText()).jsonObject.getValue("cases").jsonArray
            DynamicContainer.dynamicContainer(file.name, cases.map { raw ->
                val case = raw.jsonObject
                val name = case.getValue("name").jsonPrimitive.content
                DynamicTest.dynamicTest(name) {
                    val op = case.getValue("op").jsonPrimitive.content
                    val given = case.getValue("given").jsonObject
                    val actual = normalize(given, runOp(op, given))
                    assertEquals(case.getValue("then"), actual, "$op: $name")
                }
            })
        }
    }
}

private val todoList = ListSerializer(Todo.serializer())
private val draftList = ListSerializer(TodoDraft.serializer())

private fun JsonObject.str(key: String): String = getValue(key).jsonPrimitive.content
private fun JsonObject.instant(key: String): Instant = Instant.parse(str(key))
private fun JsonObject.local(key: String): LocalDateTime = LocalDateTime.parse(str(key))
private fun JsonObject.todos(key: String = "todos"): List<Todo> = TodoJson.decodeFromJsonElement(todoList, getValue(key))
private fun JsonObject.drafts(key: String): List<TodoDraft> = TodoJson.decodeFromJsonElement(draftList, getValue(key))
private fun encode(todos: List<Todo>): JsonElement = TodoJson.encodeToJsonElement(todoList, todos)
private fun encodeDrafts(drafts: List<TodoDraft>): JsonElement = TodoJson.encodeToJsonElement(draftList, drafts)

private fun applyStep(state: TodoState, step: JsonObject): TodoState {
    val now = step.instant("now")
    val action = when (val name = step.str("action")) {
        "add" -> TodoAction.Prepend(addTodos(emptyList(), step.drafts("drafts"), now).created)
        "toggle" -> TodoAction.Toggle(step.str("id"))
        "rename" -> TodoAction.Rename(step.str("id"), step.str("title"))
        "remove" -> TodoAction.Remove(step.getValue("ids").jsonArray.map { it.jsonPrimitive.content })
        "clearCompleted" -> TodoAction.ClearCompleted
        "undo" -> TodoAction.Undo
        "expireUndo" -> TodoAction.ExpireUndo
        else -> error("Unknown applyActions step \"$name\"")
    }
    return reduceTodos(state, action, now)
}

/** Kotlin implementation of every operation named in spec/fixtures. Unknown ops fail. */
private fun runOp(op: String, g: JsonObject): JsonElement = when (op) {
    "constants" -> buildJsonObject {
        put("storageKey", STORAGE_KEY)
        put("undoTimeoutMs", UNDO_TIMEOUT_MS)
        put("defaultPriority", DEFAULT_PRIORITY.key)
        put("priorityOrder", buildJsonObject { PRIORITY_ORDER.forEach { (p, n) -> put(p.key, n) } })
        put("emptyForm", Json { encodeDefaults = true }.encodeToJsonElement(TodoFormState.serializer(), EMPTY_TODO_FORM))
    }
    "isValidTitle" -> JsonPrimitive(isValidTitle(g.str("title")))
    "isValidDueDate" -> JsonPrimitive(isValidDueDate(g.str("value")))
    "toTodoDraft" -> TodoJson.encodeToJsonElement(
        TodoDraft.serializer(),
        toTodoDraft(TodoJson.decodeFromJsonElement(TodoFormState.serializer(), g.getValue("form"))),
    )
    "createTodo" -> TodoJson.encodeToJsonElement(
        Todo.serializer(),
        createTodo(TodoJson.decodeFromJsonElement(TodoDraft.serializer(), g.getValue("draft")), g.instant("now")),
    )
    "updateTodoText" -> encode(updateTodoText(g.todos(), g.str("id"), g.str("text"), g.instant("now")))
    "toggleTodo" -> TodoJson.encodeToJsonElement(
        Todo.serializer(),
        toggleTodo(TodoJson.decodeFromJsonElement(Todo.serializer(), g.getValue("todo")), g.instant("now")),
    )
    "filterTodos" -> encode(filterTodos(g.todos(), TodoFilter.fromKey(g.str("filter"))))
    "searchTodos" -> encode(searchTodos(g.todos(), g.str("query")))
    "sortByPriority" -> encode(sortByPriority(g.todos()))
    "countRemaining" -> JsonPrimitive(countRemaining(g.todos()))
    "addTodos" -> addTodos(g.todos(), g.drafts("drafts"), g.instant("now")).let {
        buildJsonObject {
            put("todos", encode(it.todos))
            put("created", encode(it.created))
        }
    }
    "removeFromList" -> encode(removeFromList(g.todos(), g.getValue("ids").jsonArray.map { it.jsonPrimitive.content }))
    "clearCompletedInList" -> encode(clearCompletedInList(g.todos()))
    "describeUndo" -> JsonPrimitive(
        describeUndo(UndoKind.valueOf(g.str("action").uppercase()), g.getValue("count").jsonPrimitive.int),
    )
    "isUndoExpired" -> JsonPrimitive(
        isUndoExpired(
            UndoEntry("", emptyList(), g.instant("at").toEpochMilli()),
            g.instant("now").toEpochMilli(),
            g["timeoutMs"]?.jsonPrimitive?.long ?: UNDO_TIMEOUT_MS,
        ),
    )
    "applyActions" -> {
        var state = TodoState(todos = g.todos())
        g.getValue("steps").jsonArray.forEach { state = applyStep(state, it.jsonObject) }
        buildJsonObject {
            put("todos", encode(state.todos))
            put("undoLabel", state.undoable?.label?.let(::JsonPrimitive) ?: JsonNull)
        }
    }
    "parseStoredTodos" -> encode(parseStoredTodos((g["raw"] as? JsonPrimitive)?.takeIf { it.isString }?.content))
    "serializeTodos" -> Json.parseToJsonElement(serializeTodos(g.todos()))
    "parseTranscript" -> encodeDrafts(parseTranscript(g.str("transcript"), g.local("now")))
    "extractPriority" -> TodoJson.encodeToJsonElement(PriorityMatch.serializer(), extractPriority(g.str("text")))
    "extractDueDate" -> TodoJson.encodeToJsonElement(DueDateMatch.serializer(), extractDueDate(g.str("text"), g.local("now")))
    "cleanTitle" -> JsonPrimitive(cleanTitle(g.str("text")))
    "coerceDrafts" -> encodeDrafts(coerceDrafts(g["value"]))
    "reconcileDrafts" -> encodeDrafts(reconcileDrafts(g.drafts("heuristic"), g.drafts("llm")))
    else -> error("Unknown op \"$op\"")
}

private val NEW_ID = Regex("""^new-\d+$""")

private fun collectIds(value: JsonElement, into: MutableSet<String>) {
    when (value) {
        is JsonArray -> value.forEach { collectIds(it, into) }
        is JsonObject -> value.forEach { (key, child) ->
            if (key == "id" && child is JsonPrimitive && child.isString) into.add(child.content) else collectIds(child, into)
        }
        else -> Unit
    }
}

/** Renames ids absent from `given` to new-1, new-2, … in order of first appearance. */
private fun normalize(given: JsonObject, result: JsonElement): JsonElement {
    val known = mutableSetOf<String>().also { collectIds(given, it) }
    val renamed = linkedMapOf<String, String>()
    fun walk(value: JsonElement): JsonElement = when (value) {
        is JsonArray -> JsonArray(value.map(::walk))
        is JsonObject -> JsonObject(value.mapValues { (key, child) ->
            if (key == "id" && child is JsonPrimitive && child.isString && child.content !in known && !NEW_ID.matches(child.content)) {
                JsonPrimitive(renamed.getOrPut(child.content) { "new-${renamed.size + 1}" })
            } else {
                walk(child)
            }
        })
        else -> value
    }
    return walk(result)
}
