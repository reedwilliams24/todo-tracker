package com.reedwilliams24.todotracker.core

/** UI selectors from spec/test-ids.json, applied as Compose testTags. Checked by TestIdsTest. */
object TestIds {
    const val formTitle = "todo-form-title"
    const val formPriority = "todo-form-priority"
    fun formPriorityOption(priority: String) = "todo-form-priority-$priority"
    const val formDueDate = "todo-form-due-date"
    const val formSubmit = "todo-form-submit"
    fun filter(filter: String) = "todo-filter-$filter"
    const val clearCompleted = "todo-clear-completed"
    const val list = "todo-list"
    const val empty = "todo-empty"
    const val remaining = "todo-remaining"
    fun item(title: String) = "todo-item-$title"
    fun itemToggle(title: String) = "todo-toggle-$title"
    fun itemTitle(title: String) = "todo-title-$title"
    const val itemEditInput = "todo-edit-input"
    fun itemDueDate(title: String) = "todo-due-$title"
    fun itemPriority(title: String) = "todo-priority-$title"
    fun itemDelete(title: String) = "todo-delete-$title"
    const val undoToast = "undo-toast"
    const val undoLabel = "undo-toast-label"
    const val undoAction = "undo-toast-action"
}
