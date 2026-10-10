package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.io.File

class TestIdsTest {
    @Test
    fun `matches spec test-ids registry`() {
        val registry = Json.parseToJsonElement(File("../../../spec/test-ids.json").readText()).jsonObject
            .filterKeys { !it.startsWith("$") }
            .mapValues { it.value.jsonPrimitive.content }
        // Search is not on mobile yet, so the Android app has no selector for it.
        val expected = registry - setOf("search", "searchClear")
        val actual = mapOf(
            "formTitle" to TestIds.formTitle,
            "formPriority" to TestIds.formPriority,
            "formPriorityOption" to TestIds.formPriorityOption("{priority}"),
            "formDueDate" to TestIds.formDueDate,
            "formSubmit" to TestIds.formSubmit,
            "filter" to TestIds.filter("{filter}"),
            "clearCompleted" to TestIds.clearCompleted,
            "list" to TestIds.list,
            "empty" to TestIds.empty,
            "remaining" to TestIds.remaining,
            "item" to TestIds.item("{title}"),
            "itemToggle" to TestIds.itemToggle("{title}"),
            "itemTitle" to TestIds.itemTitle("{title}"),
            "itemEditInput" to TestIds.itemEditInput,
            "itemDueDate" to TestIds.itemDueDate("{title}"),
            "itemPriority" to TestIds.itemPriority("{title}"),
            "itemDelete" to TestIds.itemDelete("{title}"),
            "undoToast" to TestIds.undoToast,
            "undoLabel" to TestIds.undoLabel,
            "undoAction" to TestIds.undoAction,
        )
        assertEquals(expected, actual)
    }
}
