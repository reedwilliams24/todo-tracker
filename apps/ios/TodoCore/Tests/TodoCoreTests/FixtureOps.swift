import Foundation
import TodoCore

/// Swift implementation of every op named in spec/fixtures; mirrors packages/spec/src/ops.ts.
enum FixtureOps {
    struct UnknownOp: Error, CustomStringConvertible {
        let op: String
        var description: String { "Unknown op \"\(op)\"" }
    }

    struct BadGiven: Error, CustomStringConvertible {
        let description: String
    }

    static func run(op: String, given: JSONValue) throws -> JSONValue {
        let result = try encode(try call(op: op, given: Given(raw: given)))
        return normalize(given: given, result: result)
    }

    // MARK: - Dispatch

    private static func call(op: String, given g: Given) throws -> any Encodable {
        switch op {
        case "constants":
            return Constants()
        case "isValidTitle":
            return isValidTitle(try g.decode("title"))
        case "isValidDueDate":
            return isValidDueDate(try g.decode("value", as: String?.self))
        case "toTodoDraft":
            return toTodoDraft(try g.decode("form"))
        case "createTodo":
            return createTodo(try g.decode("draft"), now: try g.date("now"))
        case "updateTodoText":
            return updateTodoText(try g.decode("todos"), id: try g.decode("id"), text: try g.decode("text"), now: try g.date("now"))
        case "toggleTodo":
            return toggleTodo(try g.decode("todo"), now: try g.date("now"))
        case "filterTodos":
            return filterTodos(try g.decode("todos"), try g.decode("filter"))
        case "searchTodos":
            return searchTodos(try g.decode("todos"), query: try g.decode("query"))
        case "sortByPriority":
            return sortByPriority(try g.decode("todos"))
        case "countRemaining":
            return countRemaining(try g.decode("todos"))
        case "addTodos":
            return addTodos(try g.decode("todos"), drafts: try g.decode("drafts"), now: try g.date("now"))
        case "removeFromList":
            return removeFromList(try g.decode("todos"), ids: try g.decode("ids"))
        case "clearCompletedInList":
            return clearCompletedInList(try g.decode("todos"))
        case "describeUndo":
            return describeUndo(try g.decode("action"), count: try g.decode("count"))
        case "isUndoExpired":
            let entry = UndoEntry(label: "", before: [], at: Timestamp.milliseconds(try g.date("at")))
            let timeout = try g.decode("timeoutMs", as: Int64?.self) ?? undoTimeoutMs
            return isUndoExpired(entry, now: Timestamp.milliseconds(try g.date("now")), timeoutMs: timeout)
        case "applyActions":
            var state = TodoState(todos: try g.decode("todos"))
            for step in try g.decode("steps", as: [Step].self) {
                state = try step.apply(to: state)
            }
            return ApplyActionsResult(todos: state.todos, undoLabel: state.undoable?.label)
        case "parseStoredTodos":
            return parseStoredTodos(try g.decode("raw", as: String?.self))
        case "serializeTodos":
            return try JSONDecoder().decode(JSONValue.self, from: Data(serializeTodos(try g.decode("todos")).utf8))
        case "parseTranscript":
            return parseTranscript(try g.decode("transcript"), now: try g.date("now"))
        case "extractPriority":
            return extractPriority(try g.decode("text"))
        case "extractDueDate":
            return extractDueDate(try g.decode("text"), now: try g.date("now"))
        case "cleanTitle":
            return cleanTitle(try g.decode("text"))
        case "coerceDrafts":
            return coerceDrafts(g.raw["value"] ?? .null)
        case "reconcileDrafts":
            return reconcileDrafts(heuristic: try g.decode("heuristic"), llm: try g.decode("llm"))
        default:
            throw UnknownOp(op: op)
        }
    }

    private struct Constants: Encodable {
        let storageKey = TodoCore.storageKey
        let undoTimeoutMs = TodoCore.undoTimeoutMs
        let defaultPriority = TodoCore.defaultPriority
        let priorityOrder = Dictionary(uniqueKeysWithValues: TodoPriority.allCases.map { ($0.rawValue, $0.order) })
        let emptyForm = TodoFormState.empty
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

        func apply(to state: TodoState) throws -> TodoState {
            guard let date = Timestamp.parse(now) else { throw BadGiven(description: "bad step now \(now)") }
            let action: TodoAction
            switch self.action {
            case "add":
                let created = addTodos([], drafts: drafts ?? [], now: date).created
                action = .prepend(created)
            case "toggle": action = .toggle(id: try require(id))
            case "rename": action = .rename(id: try require(id), title: try require(title))
            case "remove": action = .remove(ids: try require(ids))
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

    // MARK: - Given

    struct Given {
        let raw: JSONValue

        func decode<T: Decodable>(_ key: String, as type: T.Type = T.self) throws -> T {
            let value = raw[key] ?? .null
            let data = try JSONEncoder().encode(value)
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                throw BadGiven(description: "given.\(key) is not \(T.self): \(value)")
            }
        }

        /// UTC when the value ends in Z, local time otherwise (voice ops).
        func date(_ key: String) throws -> Date {
            let value: String = try decode(key)
            guard let date = Timestamp.parse(value) else { throw BadGiven(description: "given.\(key) is not a date: \(value)") }
            return date
        }
    }

    // MARK: - Normalization (spec/README.md#normalization)

    private static func encode(_ value: any Encodable) throws -> JSONValue {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try JSONDecoder().decode(JSONValue.self, from: try encoder.encode(value))
    }

    /// Drops null values from nested objects (keeping top-level result fields like
    /// `undoLabel: null`) and renames ids that are not in `given` to new-1, new-2, … in
    /// order of first appearance (keys visited in sorted order, as serialized).
    static func normalize(given: JSONValue, result: JSONValue) -> JSONValue {
        var known = Set<String>()
        collectIds(given, into: &known)
        var renamed: [String: String] = [:]

        func walk(_ value: JSONValue, topLevel: Bool = false) -> JSONValue {
            switch value {
            case .array(let items):
                return .array(items.map { walk($0) })
            case .object(let fields):
                var out: [String: JSONValue] = [:]
                for key in fields.keys.sorted() {
                    let child = fields[key]!
                    if child == .null {
                        if topLevel { out[key] = .null }
                        continue
                    }
                    if key == "id", case .string(let id) = child, !known.contains(id), !isNewId(id) {
                        if renamed[id] == nil { renamed[id] = "new-\(renamed.count + 1)" }
                        out[key] = .string(renamed[id]!)
                    } else {
                        out[key] = walk(child)
                    }
                }
                return .object(out)
            default:
                return value
            }
        }
        return walk(result, topLevel: true)
    }

    private static func isNewId(_ id: String) -> Bool {
        id.hasPrefix("new-") && !id.dropFirst(4).isEmpty && id.dropFirst(4).allSatisfy(\.isASCIIDigit)
    }

    private static func collectIds(_ value: JSONValue, into known: inout Set<String>) {
        switch value {
        case .array(let items):
            items.forEach { collectIds($0, into: &known) }
        case .object(let fields):
            for (key, child) in fields {
                if key == "id", case .string(let id) = child { known.insert(id) } else { collectIds(child, into: &known) }
            }
        default:
            break
        }
    }
}

private extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}
