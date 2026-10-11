package com.reedwilliams24.todotracker.core

/** UI selectors from spec/test-ids.json, applied as Compose testTags. Checked by TestIdsTest. */
object TestIds {
    const val authAccount = "auth-account"
    const val authAccountEmail = "auth-account-email"
    const val authCancel = "auth-cancel"
    const val authChangeEmail = "auth-change-email"
    const val authCode = "auth-code"
    const val authEmail = "auth-email"
    const val authError = "auth-error"
    const val authExpiredBanner = "auth-expired-banner"
    const val authGuestBanner = "auth-guest-banner"
    const val authMoveConfirm = "auth-move-confirm"
    const val authMoveDiscard = "auth-move-discard"
    const val authMoveError = "auth-move-error"
    const val authMovePrompt = "auth-move-prompt"
    const val authResend = "auth-resend"
    const val authSendCode = "auth-send-code"
    const val authSheet = "auth-sheet"
    const val authSignIn = "auth-sign-in"
    const val authSignOut = "auth-sign-out"
    const val authVerify = "auth-verify"
    const val bulkBar = "todo-bulk-bar"
    const val bulkDelete = "todo-bulk-delete"
    const val bulkDeleteCancel = "todo-bulk-delete-cancel"
    const val bulkDeleteConfirm = "todo-bulk-delete-confirm"
    const val bulkToggle = "todo-bulk-toggle"
    const val clearCompleted = "todo-clear-completed"
    const val empty = "todo-empty"

    fun filter(filter: String) = "todo-filter-$filter"

    const val formDueDate = "todo-form-due-date"
    const val formPriority = "todo-form-priority"

    fun formPriorityOption(priority: String) = "todo-form-priority-$priority"

    const val formRecurrence = "todo-form-recurrence"

    fun formRecurrenceOption(recurrence: String) = "todo-form-recurrence-$recurrence"

    const val formReminder = "todo-form-reminder"

    fun formReminderOption(reminder: String) = "todo-form-reminder-$reminder"

    const val formSubmit = "todo-form-submit"
    const val formTitle = "todo-form-title"

    fun item(title: String) = "todo-item-$title"

    fun itemDelete(title: String) = "todo-delete-$title"

    fun itemDueDate(title: String) = "todo-due-$title"

    const val itemEditInput = "todo-edit-input"

    fun itemOverdue(title: String) = "todo-overdue-$title"

    fun itemPriority(title: String) = "todo-priority-$title"

    fun itemRecurrence(title: String) = "todo-recurrence-$title"

    fun itemReminder(title: String) = "todo-reminder-$title"

    fun itemSelect(title: String) = "todo-select-item-$title"

    fun itemSubtaskProgress(title: String) = "todo-subtasks-progress-$title"

    fun itemSubtasksToggle(title: String) = "todo-subtasks-toggle-$title"

    fun itemTitle(title: String) = "todo-title-$title"

    fun itemToggle(title: String) = "todo-toggle-$title"

    const val list = "todo-list"
    const val quickAddPreview = "todo-quick-add-preview"
    const val quickAddPreviewTitle = "todo-quick-add-preview-title"
    const val remaining = "todo-remaining"
    const val selectAll = "todo-select-all"
    const val selectMode = "todo-select-mode"
    const val selectedCount = "todo-selected-count"
    const val sort = "todo-sort"

    fun sortOption(sort: String) = "todo-sort-$sort"

    const val statsChart = "stats-chart"
    const val statsCurrent = "stat-current"
    const val statsLongest = "stat-longest"
    const val statsToggle = "stats-toggle"
    const val statsTotal = "stat-total"

    fun subtask(title: String) = "todo-subtask-$title"

    fun subtaskDelete(title: String) = "todo-subtask-delete-$title"

    fun subtaskInput(title: String) = "todo-subtask-input-$title"

    fun subtaskToggle(title: String) = "todo-subtask-toggle-$title"

    const val syncError = "sync-error-toast"

    fun themeOption(theme: String) = "theme-option-$theme"

    const val themeToggle = "theme-toggle"
    const val undoAction = "undo-toast-action"
    const val undoLabel = "undo-toast-label"
    const val undoToast = "undo-toast"
}
