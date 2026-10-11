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
import java.time.ZoneId

/** JSON helpers shared by the <Feature>FixtureOps.kt files. */
internal val todoList = ListSerializer(Todo.serializer())
internal val draftList = ListSerializer(TodoDraft.serializer())

internal fun JsonObject.str(key: String): String = getValue(key).jsonPrimitive.content
internal fun JsonObject.instant(key: String): Instant = Instant.parse(str(key))
internal fun JsonObject.local(key: String): LocalDateTime = LocalDateTime.parse(str(key))
internal fun JsonObject.todos(key: String = "todos"): List<Todo> = TodoJson.decodeFromJsonElement(todoList, getValue(key))
internal fun JsonObject.drafts(key: String): List<TodoDraft> = TodoJson.decodeFromJsonElement(draftList, getValue(key))
internal fun JsonObject.quickAddParse(): QuickAddParse = TodoJson.decodeFromJsonElement(QuickAddParse.serializer(), getValue("parse"))
internal fun encode(todos: List<Todo>): JsonElement = TodoJson.encodeToJsonElement(todoList, todos)
internal fun encodeDrafts(drafts: List<TodoDraft>): JsonElement = TodoJson.encodeToJsonElement(draftList, drafts)
