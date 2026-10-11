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
            "formReminder" to TestIds.formReminder,
            "formReminderOption" to TestIds.formReminderOption("{reminder}"),
            "formSubmit" to TestIds.formSubmit,
            "quickAddPreview" to TestIds.quickAddPreview,
            "quickAddPreviewTitle" to TestIds.quickAddPreviewTitle,
            "filter" to TestIds.filter("{filter}"),
            "sort" to TestIds.sort,
            "sortOption" to TestIds.sortOption("{sort}"),
            "clearCompleted" to TestIds.clearCompleted,
            "list" to TestIds.list,
            "empty" to TestIds.empty,
            "remaining" to TestIds.remaining,
            "item" to TestIds.item("{title}"),
            "itemToggle" to TestIds.itemToggle("{title}"),
            "itemTitle" to TestIds.itemTitle("{title}"),
            "itemEditInput" to TestIds.itemEditInput,
            "itemDueDate" to TestIds.itemDueDate("{title}"),
            "itemReminder" to TestIds.itemReminder("{title}"),
            "itemOverdue" to TestIds.itemOverdue("{title}"),
            "itemPriority" to TestIds.itemPriority("{title}"),
            "itemDelete" to TestIds.itemDelete("{title}"),
            "undoToast" to TestIds.undoToast,
            "undoLabel" to TestIds.undoLabel,
            "undoAction" to TestIds.undoAction,
        )
        assertEquals(expected, actual)
    }
}
