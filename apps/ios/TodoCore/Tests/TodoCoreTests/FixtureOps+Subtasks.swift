import TodoCore

/// `subtasks` ops; mirrors packages/spec/src/features/subtasks.ts.
extension FixtureOps {
    static var subtasksOps: [String: Op] {
        [
            "subtaskProgress": { g in
                return subtaskProgress(try g.decode("todo"))
            },
            "addSubtask": { g in
                return addSubtask(try g.decode("todo"), title: try g.decode("title"), now: try g.date("now"))
            },
            "toggleSubtask": { g in
                return toggleSubtask(try g.decode("todo"), subtaskId: try g.decode("subtaskId"), now: try g.date("now"))
            },
            "removeSubtask": { g in
                return removeSubtask(try g.decode("todo"), subtaskId: try g.decode("subtaskId"), now: try g.date("now"))
            },
        ]
    }
}
