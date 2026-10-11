import TodoCore

/// `undo` ops; mirrors packages/spec/src/features/undo.ts.
extension FixtureOps {
    static var undoOps: [String: Op] {
        [
            "describeUndo": { g in
                return describeUndo(try g.decode("action"), count: try g.decode("count"))
            },
            "isUndoExpired": { g in
                let entry = UndoEntry(label: "", before: [], at: Timestamp.milliseconds(try g.date("at")))
                let timeout = try g.decode("timeoutMs", as: Int64?.self) ?? undoTimeoutMs
                return isUndoExpired(entry, now: Timestamp.milliseconds(try g.date("now")), timeoutMs: timeout)
            },
            "applyActions": { g in
                var state = TodoState(todos: try g.decode("todos"))
                for step in try g.decode("steps", as: [Step].self) {
                    state = try step.apply(to: state)
                }
                return ApplyActionsResult(todos: state.todos, undoLabel: state.undoable?.label)
            },
        ]
    }

    /// `undoLabel` is always present, so a missing label encodes as `null` rather than being omitted.
    private struct ApplyActionsResult: Encodable {
        let todos: [Todo]
        let undoLabel: String?

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(todos, forKey: .todos)
            try container.encode(undoLabel, forKey: .undoLabel)
        }

        enum CodingKeys: String, CodingKey { case todos, undoLabel }
    }

    private struct Step: Decodable {
        let action: String
        let now: String
        let drafts: [TodoDraft]?
        let id: String?
        let title: String?
        let ids: [String]?
        let visibleIds: [String]?
        let targetId: String?

        func apply(to state: TodoState) throws -> TodoState {
            guard let date = Timestamp.parse(now) else { throw BadGiven(description: "bad step now \(now)") }
            let action: TodoAction
            switch self.action {
            case "add":
                let created = addTodos([], drafts: drafts ?? [], now: date).created
                action = .prepend(created)
            case "toggle": action = .toggle(id: try require(id))
            case "toggleMany": action = .toggleMany(ids: try require(ids))
            case "rename": action = .rename(id: try require(id), title: try require(title))
            case "remove": action = .remove(ids: try require(ids))
            case "reorder":
                action = .reorder(
                    visibleIds: try require(visibleIds), id: try require(id), targetId: try require(targetId))
            case "clearCompleted": action = .clearCompleted
            case "undo": action = .undo
            case "expireUndo": action = .expireUndo
            default: throw BadGiven(description: "unknown step action \(self.action)")
            }
            return reduceTodos(state, action, now: date)
        }

        private func require<T>(_ value: T?) throws -> T {
            guard let value else { throw BadGiven(description: "step \(action) is missing a field") }
            return value
        }
    }
}
