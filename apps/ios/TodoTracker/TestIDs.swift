import TodoCore

/// Accessibility identifiers from spec/test-ids.json.
enum TestID {
    static let formTitle = "todo-form-title"
    static let formPriority = "todo-form-priority"
    static func formPriorityOption(_ priority: TodoPriority) -> String { "todo-form-priority-\(priority.rawValue)" }
    static let formDueDate = "todo-form-due-date"
    static let formSubmit = "todo-form-submit"
    static func filter(_ filter: TodoFilter) -> String { "todo-filter-\(filter.rawValue)" }
    static let clearCompleted = "todo-clear-completed"
    static let list = "todo-list"
    static let empty = "todo-empty"
    static let remaining = "todo-remaining"
    static func item(_ title: String) -> String { "todo-item-\(title)" }
    static func itemToggle(_ title: String) -> String { "todo-toggle-\(title)" }
    static func itemTitle(_ title: String) -> String { "todo-title-\(title)" }
    static let itemEditInput = "todo-edit-input"
    static func itemDueDate(_ title: String) -> String { "todo-due-\(title)" }
    static func itemPriority(_ title: String) -> String { "todo-priority-\(title)" }
    static func itemDelete(_ title: String) -> String { "todo-delete-\(title)" }
    static let undoToast = "undo-toast"
    static let undoLabel = "undo-toast-label"
    static let undoAction = "undo-toast-action"
    static let authPanel = "auth-panel"
    static let authEmail = "auth-email"
    static let authSendCode = "auth-send"
    static let authCode = "auth-code"
    static let authVerify = "auth-verify"
    static let authGoogle = "auth-google"
    static let authApple = "auth-apple"
    static let authStatus = "auth-status"
    static let authUser = "auth-user"
    static let authSignOut = "auth-sign-out"
}
