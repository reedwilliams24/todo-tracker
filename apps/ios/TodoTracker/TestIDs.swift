import TodoCore

/// Accessibility identifiers from spec/test-ids.json.
enum TestID {
    static let formTitle = "todo-form-title"
    static let formPriority = "todo-form-priority"
    static func formPriorityOption(_ priority: TodoPriority) -> String { "todo-form-priority-\(priority.rawValue)" }
    static let formDueDate = "todo-form-due-date"
    static let formSubmit = "todo-form-submit"
    static let quickAddPreview = "todo-quick-add-preview"
    static let quickAddPreviewTitle = "todo-quick-add-preview-title"
    static func filter(_ filter: TodoFilter) -> String { "todo-filter-\(filter.rawValue)" }
    static let sort = "todo-sort"
    static func sortOption(_ sort: TodoSort) -> String { "todo-sort-\(sort.rawValue)" }
    static let clearCompleted = "todo-clear-completed"
    static let selectMode = "todo-select-mode"
    static let bulkBar = "todo-bulk-bar"
    static let selectedCount = "todo-selected-count"
    static let selectAll = "todo-select-all"
    static let bulkToggle = "todo-bulk-toggle"
    static let bulkDelete = "todo-bulk-delete"
    static let bulkDeleteConfirm = "todo-bulk-delete-confirm"
    static let bulkDeleteCancel = "todo-bulk-delete-cancel"
    static let list = "todo-list"
    static let empty = "todo-empty"
    static let remaining = "todo-remaining"
    static func item(_ title: String) -> String { "todo-item-\(title)" }
    static func itemToggle(_ title: String) -> String { "todo-toggle-\(title)" }
    static func itemSelect(_ title: String) -> String { "todo-select-item-\(title)" }
    static func itemTitle(_ title: String) -> String { "todo-title-\(title)" }
    static let itemEditInput = "todo-edit-input"
    static func itemDueDate(_ title: String) -> String { "todo-due-\(title)" }
    static func itemOverdue(_ title: String) -> String { "todo-overdue-\(title)" }
    static func itemPriority(_ title: String) -> String { "todo-priority-\(title)" }
    static func itemDelete(_ title: String) -> String { "todo-delete-\(title)" }
    static let undoToast = "undo-toast"
    static let undoLabel = "undo-toast-label"
    static let undoAction = "undo-toast-action"
}
