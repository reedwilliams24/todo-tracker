package com.reedwilliams24.todotracker.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class TodoPriority {
    @SerialName("low") LOW,
    @SerialName("medium") MEDIUM,
    @SerialName("high") HIGH;

    val key: String get() = name.lowercase()
}

/** Reminder offset from a todo's due date (spec/features/reminders.md). */
@Serializable
enum class ReminderOffset(val key: String, val label: String) {
    @SerialName("at") AT("at", "When due"),
    @SerialName("1h") HOUR_BEFORE("1h", "1 hour before"),
    @SerialName("1d") DAY_BEFORE("1d", "1 day before");

    companion object {
        fun fromKey(key: String?): ReminderOffset? = entries.firstOrNull { it.key == key }
    }
}

@Serializable
data class Todo(
    val id: String,
    val title: String,
    val notes: String? = null,
    val completed: Boolean,
    val priority: TodoPriority,
    val dueDate: String? = null,
    val reminder: ReminderOffset? = null,
    val createdAt: String,
    val updatedAt: String,
)

enum class TodoFilter {
    ALL, ACTIVE, COMPLETED;

    val key: String get() = name.lowercase()

    companion object {
        fun fromKey(key: String): TodoFilter = entries.firstOrNull { it.key == key } ?: ALL
    }
}

enum class TodoSort {
    PRIORITY, DUE;

    val key: String get() = name.lowercase()

    companion object {
        fun fromKey(key: String): TodoSort = entries.firstOrNull { it.key == key } ?: PRIORITY
    }
}

@Serializable
data class TodoDraft(
    val title: String,
    val notes: String? = null,
    val priority: TodoPriority? = null,
    val dueDate: String? = null,
    val reminder: ReminderOffset? = null,
)

/** Controlled-input state for the add form; dueDate and reminder are "" when unset. */
@Serializable
data class TodoFormState(
    val title: String = "",
    val priority: TodoPriority = DEFAULT_PRIORITY,
    val dueDate: String = "",
    val reminder: String = "",
)
