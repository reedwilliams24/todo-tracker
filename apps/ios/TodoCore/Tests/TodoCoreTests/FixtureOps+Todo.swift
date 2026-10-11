import TodoCore

/// `todo` ops; mirrors packages/spec/src/features/todo.ts.
extension FixtureOps {
    static var todoOps: [String: Op] {
        [
            "constants": { g in
                return Constants()
            },
            "isValidTitle": { g in
                return isValidTitle(try g.decode("title"))
            },
            "isValidDueDate": { g in
                return isValidDueDate(try g.decode("value", as: String?.self))
            },
            "toTodoDraft": { g in
                return toTodoDraft(try g.decode("form"))
            },
            "createTodo": { g in
                return createTodo(try g.decode("draft"), now: try g.date("now"))
            },
            "updateTodoText": { g in
                return updateTodoText(
                    try g.decode("todos"), id: try g.decode("id"), text: try g.decode("text"), now: try g.date("now"))
            },
            "toggleTodo": { g in
                return toggleTodo(try g.decode("todo"), now: try g.date("now"))
            },
            "isOverdue": { g in
                return isOverdue(try g.decode("todo"), now: try g.date("now"))
            },
            "toDateKey": { g in
                return toDateKey(try g.date("now"))
            },
        ]
    }

    private struct Constants: Encodable {
        let storageKey = TodoCore.storageKey
        let undoTimeoutMs = TodoCore.undoTimeoutMs
        let defaultPriority = TodoCore.defaultPriority
        let priorityOrder = Dictionary(uniqueKeysWithValues: TodoPriority.allCases.map { ($0.rawValue, $0.order) })
        let emptyForm = TodoFormState.empty
    }
}
