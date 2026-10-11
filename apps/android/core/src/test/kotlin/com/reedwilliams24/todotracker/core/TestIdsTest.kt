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
            "bulkBar" to TestIds.bulkBar,
            "bulkDelete" to TestIds.bulkDelete,
            "bulkDeleteCancel" to TestIds.bulkDeleteCancel,
            "bulkDeleteConfirm" to TestIds.bulkDeleteConfirm,
            "bulkToggle" to TestIds.bulkToggle,
            "clearCompleted" to TestIds.clearCompleted,
            "empty" to TestIds.empty,
            "filter" to TestIds.filter("{filter}"),
            "formDueDate" to TestIds.formDueDate,
            "formPriority" to TestIds.formPriority,
            "formPriorityOption" to TestIds.formPriorityOption("{priority}"),
            "formRecurrence" to TestIds.formRecurrence,
            "formRecurrenceOption" to TestIds.formRecurrenceOption("{recurrence}"),
            "formSubmit" to TestIds.formSubmit,
            "formTitle" to TestIds.formTitle,
            "item" to TestIds.item("{title}"),
            "itemDelete" to TestIds.itemDelete("{title}"),
            "itemDueDate" to TestIds.itemDueDate("{title}"),
            "itemEditInput" to TestIds.itemEditInput,
            "itemOverdue" to TestIds.itemOverdue("{title}"),
            "itemPriority" to TestIds.itemPriority("{title}"),
            "itemRecurrence" to TestIds.itemRecurrence("{title}"),
            "itemSelect" to TestIds.itemSelect("{title}"),
            "itemTitle" to TestIds.itemTitle("{title}"),
            "itemToggle" to TestIds.itemToggle("{title}"),
            "list" to TestIds.list,
            "quickAddPreview" to TestIds.quickAddPreview,
            "quickAddPreviewTitle" to TestIds.quickAddPreviewTitle,
            "remaining" to TestIds.remaining,
            "selectAll" to TestIds.selectAll,
            "selectMode" to TestIds.selectMode,
            "selectedCount" to TestIds.selectedCount,
            "sort" to TestIds.sort,
            "sortOption" to TestIds.sortOption("{sort}"),
            "statsChart" to TestIds.statsChart,
            "statsCurrent" to TestIds.statsCurrent,
            "statsLongest" to TestIds.statsLongest,
            "statsToggle" to TestIds.statsToggle,
            "statsTotal" to TestIds.statsTotal,
            "themeOption" to TestIds.themeOption("{theme}"),
            "themeToggle" to TestIds.themeToggle,
            "undoAction" to TestIds.undoAction,
            "undoLabel" to TestIds.undoLabel,
            "undoToast" to TestIds.undoToast,
        )
        assertEquals(expected, actual)
    }
}
