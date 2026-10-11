package com.reedwilliams24.todotracker.core

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

/** `undo` ops; mirrors packages/spec/src/features/undo.ts. */
internal val undoOps: Map<String, Op> =
    mapOf(
        "describeUndo" to
            { g: JsonObject ->
                JsonPrimitive(
                    describeUndo(UndoKind.valueOf(g.str("action").uppercase()), g.getValue("count").jsonPrimitive.int)
                )
            },
        "isUndoExpired" to
            { g: JsonObject ->
                JsonPrimitive(
                    isUndoExpired(
                        UndoEntry("", emptyList(), g.instant("at").toEpochMilli()),
                        g.instant("now").toEpochMilli(),
                        g["timeoutMs"]?.jsonPrimitive?.long ?: UNDO_TIMEOUT_MS,
                    )
                )
            },
        "applyActions" to
            { g: JsonObject ->
                var state = TodoState(todos = g.todos())
                g.getValue("steps").jsonArray.forEach { state = applyStep(state, it.jsonObject) }
                buildJsonObject {
                    put("todos", encode(state.todos))
                    put("undoLabel", state.undoable?.label?.let(::JsonPrimitive) ?: JsonNull)
                }
            },
    )

private fun applyStep(state: TodoState, step: JsonObject): TodoState {
    val now = step.instant("now")
    val action =
        when (val name = step.str("action")) {
            "add" -> TodoAction.Prepend(addTodos(emptyList(), step.drafts("drafts"), now).created)
            "toggle" -> TodoAction.Toggle(step.str("id"))
            "toggleMany" -> TodoAction.ToggleMany(step.getValue("ids").jsonArray.map { it.jsonPrimitive.content })
            "rename" -> TodoAction.Rename(step.str("id"), step.str("title"))
            "remove" -> TodoAction.Remove(step.getValue("ids").jsonArray.map { it.jsonPrimitive.content })
            "reorder" -> TodoAction.Reorder(step.strings("visibleIds"), step.str("id"), step.str("targetId"))
            "clearCompleted" -> TodoAction.ClearCompleted
            "addSubtask" -> TodoAction.AddSubtask(step.str("id"), step.str("title"))
            "toggleSubtask" -> TodoAction.ToggleSubtask(step.str("id"), step.str("subtaskId"))
            "removeSubtask" -> TodoAction.RemoveSubtask(step.str("id"), step.str("subtaskId"))
            "undo" -> TodoAction.Undo
            "expireUndo" -> TodoAction.ExpireUndo
            else -> error("Unknown applyActions step \"$name\"")
        }
    return reduceTodos(state, action, now)
}
