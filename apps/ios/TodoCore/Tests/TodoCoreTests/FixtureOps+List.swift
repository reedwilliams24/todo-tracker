import TodoCore

/// `list` ops; mirrors packages/spec/src/features/list.ts.
extension FixtureOps {
    static var listOps: [String: Op] {
        [
            "filterTodos": { g in
                    return filterTodos(try g.decode("todos"), try g.decode("filter"))
            },
            "searchTodos": { g in
                    return searchTodos(try g.decode("todos"), query: try g.decode("query"))
            },
            "sortByPriority": { g in
                    return sortByPriority(try g.decode("todos"))
            },
            "sortByDue": { g in
                    return sortByDue(try g.decode("todos"))
            },
            "sortTodos": { g in
                    let sort = try g.decode("sort", as: String?.self).flatMap(TodoSort.init(rawValue:)) ?? .priority
                    return sortTodos(try g.decode("todos"), sort)
            },
            "countRemaining": { g in
                    return countRemaining(try g.decode("todos"))
            },
            "countCompleted": { g in
                    return countCompleted(try g.decode("todos"))
            },
            "addTodos": { g in
                    return addTodos(try g.decode("todos"), drafts: try g.decode("drafts"), now: try g.date("now"))
            },
            "toggleInList": { g in
                    return toggleInList(try g.decode("todos"), id: try g.decode("id"), now: try g.date("now"))
            },
            "removeFromList": { g in
                    return removeFromList(try g.decode("todos"), ids: try g.decode("ids"))
            },
            "clearCompletedInList": { g in
                    return clearCompletedInList(try g.decode("todos"))
            },
            "moveVisibleTodo": { g in
                    return moveVisibleTodo(
                        try g.decode("todos"), visibleIds: try g.decode("visibleIds"),
                        id: try g.decode("id"), targetId: try g.decode("targetId")
                    )
            },
            "reorderTodos": { g in
                    return reorderTodos(try g.decode("todos"), fromIndex: try g.decode("fromIndex"), toIndex: try g.decode("toIndex"))
            },
            "bulkToggle": { g in
                    return bulkToggle(try g.decode("todos"), ids: try g.decode("ids"), now: try g.date("now"))
            },
        ]
    }
}
