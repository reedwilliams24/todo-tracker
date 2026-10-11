package com.reedwilliams24.todotracker.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class TodoPriority {
    @SerialName("low") LOW,
    @SerialName("medium") MEDIUM,
    @SerialName("high") HIGH;

    val key: String
        get() = name.lowercase()
}

/** Repeat rule; see spec/features/recurrence.md. */
@Serializable
enum class Recurrence(val label: String) {
    @SerialName("daily") DAILY("Daily"),
    @SerialName("weekly") WEEKLY("Weekly"),
    @SerialName("monthly") MONTHLY("Monthly");

    val key: String
        get() = name.lowercase()

    companion object {
        fun fromKey(key: String): Recurrence? = entries.firstOrNull { it.key == key }
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
    val recurrence: Recurrence? = null,
    val createdAt: String,
    val updatedAt: String,
    /** When the todo was last completed; null while open and for data from before REED-19. */
    val completedAt: String? = null,
)

enum class TodoFilter {
    ALL,
    ACTIVE,
    COMPLETED;

    val key: String
        get() = name.lowercase()

    companion object {
        fun fromKey(key: String): TodoFilter = entries.firstOrNull { it.key == key } ?: ALL
    }
}

enum class TodoSort {
    PRIORITY,
    DUE;

    val key: String
        get() = name.lowercase()

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
    val recurrence: Recurrence? = null,
)

/** Controlled-input state for the add form; dueDate and recurrence are "" when unset. */
@Serializable
data class TodoFormState(
    val title: String = "",
    val priority: TodoPriority = DEFAULT_PRIORITY,
    val dueDate: String = "",
    val recurrence: String = "",
)
