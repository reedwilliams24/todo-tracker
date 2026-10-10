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

@Serializable
data class Todo(
    val id: String,
    val title: String,
    val notes: String? = null,
    val completed: Boolean,
    val priority: TodoPriority,
    val dueDate: String? = null,
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

@Serializable
data class TodoDraft(
    val title: String,
    val notes: String? = null,
    val priority: TodoPriority? = null,
    val dueDate: String? = null,
)

/** Controlled-input state for the add form; dueDate is "" when unset. */
@Serializable
data class TodoFormState(
    val title: String = "",
    val priority: TodoPriority = DEFAULT_PRIORITY,
    val dueDate: String = "",
)
