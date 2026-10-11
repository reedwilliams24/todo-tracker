import TodoCore

/// Accessibility identifiers from spec/test-ids.json.
enum TestID {
    static let bulkBar = "todo-bulk-bar"
    static let bulkDelete = "todo-bulk-delete"
    static let bulkDeleteCancel = "todo-bulk-delete-cancel"
    static let bulkDeleteConfirm = "todo-bulk-delete-confirm"
    static let bulkToggle = "todo-bulk-toggle"
    static let clearCompleted = "todo-clear-completed"
    static let empty = "todo-empty"
    static func filter(_ filter: TodoFilter) -> String { "todo-filter-\(filter.rawValue)" }
    static let formDueDate = "todo-form-due-date"
    static let formPriority = "todo-form-priority"
    static func formPriorityOption(_ priority: TodoPriority) -> String { "todo-form-priority-\(priority.rawValue)" }
    static let formRecurrence = "todo-form-recurrence"
    static func formRecurrenceOption(_ recurrence: Recurrence?) -> String {
        "todo-form-recurrence-\(recurrence?.rawValue ?? "none")"
    }
    static let formReminder = "todo-form-reminder"
    static func formReminderOption(_ reminder: String) -> String { "todo-form-reminder-\(reminder)" }
    static let formSubmit = "todo-form-submit"
    static let formTitle = "todo-form-title"
    static func item(_ title: String) -> String { "todo-item-\(title)" }
    static func itemDelete(_ title: String) -> String { "todo-delete-\(title)" }
    static func itemDueDate(_ title: String) -> String { "todo-due-\(title)" }
    static let itemEditInput = "todo-edit-input"
    static func itemOverdue(_ title: String) -> String { "todo-overdue-\(title)" }
    static func itemPriority(_ title: String) -> String { "todo-priority-\(title)" }
    static func itemRecurrence(_ title: String) -> String { "todo-recurrence-\(title)" }
    static func itemReminder(_ title: String) -> String { "todo-reminder-\(title)" }
    static func itemSelect(_ title: String) -> String { "todo-select-item-\(title)" }
    static func itemTitle(_ title: String) -> String { "todo-title-\(title)" }
    static func itemToggle(_ title: String) -> String { "todo-toggle-\(title)" }
    static let list = "todo-list"
    static let quickAddPreview = "todo-quick-add-preview"
    static let quickAddPreviewTitle = "todo-quick-add-preview-title"
    static let remaining = "todo-remaining"
    static let selectAll = "todo-select-all"
    static let selectMode = "todo-select-mode"
    static let selectedCount = "todo-selected-count"
    static let sort = "todo-sort"
    static func sortOption(_ sort: TodoSort) -> String { "todo-sort-\(sort.rawValue)" }
    static let statsChart = "stats-chart"
    static let statsCurrent = "stat-current"
    static let statsLongest = "stat-longest"
    static let statsToggle = "stats-toggle"
    static let statsTotal = "stat-total"
    static func themeOption(_ theme: ThemePreference) -> String { "theme-option-\(theme.rawValue)" }
    static let themeToggle = "theme-toggle"
    static let undoAction = "undo-toast-action"
    static let undoLabel = "undo-toast-label"
    static let undoToast = "undo-toast"
}
