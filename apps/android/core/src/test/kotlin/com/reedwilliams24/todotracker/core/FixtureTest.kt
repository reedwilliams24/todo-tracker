package com.reedwilliams24.todotracker.core

import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicContainer
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/** Runs every case in spec/fixtures against the Kotlin implementation (see spec/README.md). */
class FixtureTest {
    private val fixtureDir: File =
        File(requireNotNull(javaClass.classLoader.getResource("todo.json")).toURI()).parentFile

    @TestFactory
    fun fixtures(): List<DynamicContainer> {
        val files = fixtureDir.listFiles { f -> f.extension == "json" }!!.sortedBy { it.name }
        assertTrue(files.isNotEmpty(), "no fixture files found in $fixtureDir")
        return files.mapNotNull { file ->
            val fixture = Json.parseToJsonElement(file.readText()).jsonObject
            if (fixture["status"]?.jsonObject?.get("android")?.jsonPrimitive?.content == "n/a") return@mapNotNull null
            val cases = fixture.getValue("cases").jsonArray
            DynamicContainer.dynamicContainer(
                file.name,
                cases.map { raw ->
                    val case = raw.jsonObject
                    val name = case.getValue("name").jsonPrimitive.content
                    DynamicTest.dynamicTest(name) {
                        val op = case.getValue("op").jsonPrimitive.content
                        val given = case.getValue("given").jsonObject
                        val actual = normalize(given, runOp(op, given))
                        assertEquals(case.getValue("then"), actual, "$op: $name")
                    }
                },
            )
        }
    }
}

internal typealias Op = (JsonObject) -> JsonElement

/**
 * One table per feature, each in its own <Feature>FixtureOps.kt. Keep one per line, in alphabetical order, so features
 * added in parallel don't conflict.
 */
private val OPS: Map<String, Op> = buildMap {
    listOf(
            authOps,
            listOps,
            quickAddOps,
            recurrenceOps,
            remindersOps,
            statsOps,
            storageOps,
            subtasksOps,
            syncOps,
            themeOps,
            todoOps,
            undoOps,
            voiceOps,
        )
        .forEach { module ->
            module.forEach { (op, impl) -> check(put(op, impl) == null) { "op \"$op\" is defined twice" } }
        }
}

/** Runs the Kotlin implementation of an op named in spec/fixtures. Unknown ops fail. */
private fun runOp(op: String, g: JsonObject): JsonElement = OPS[op]?.invoke(g) ?: error("Unknown op \"$op\"")

private val NEW_ID = Regex("""^new-\d+$""")

private fun collectIds(value: JsonElement, into: MutableSet<String>) {
    when (value) {
        is JsonArray -> value.forEach { collectIds(it, into) }
        is JsonObject ->
            value.forEach { (key, child) ->
                if (key == "id" && child is JsonPrimitive && child.isString) into.add(child.content)
                else collectIds(child, into)
            }
        else -> Unit
    }
}

/** Renames ids absent from `given` to new-1, new-2, … in order of first appearance. */
private fun normalize(given: JsonObject, result: JsonElement): JsonElement {
    val known = mutableSetOf<String>().also { collectIds(given, it) }
    val renamed = linkedMapOf<String, String>()
    fun walk(value: JsonElement): JsonElement =
        when (value) {
            is JsonArray -> JsonArray(value.map(::walk))
            is JsonObject ->
                JsonObject(
                    value.mapValues { (key, child) ->
                        if (
                            key == "id" &&
                                child is JsonPrimitive &&
                                child.isString &&
                                child.content !in known &&
                                !NEW_ID.matches(child.content)
                        ) {
                            JsonPrimitive(renamed.getOrPut(child.content) { "new-${renamed.size + 1}" })
                        } else {
                            walk(child)
                        }
                    }
                )
            else -> value
        }
    return walk(result)
}
