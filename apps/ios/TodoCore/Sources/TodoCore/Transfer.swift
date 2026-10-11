import Foundation

/// Port of packages/shared/src/transfer.ts; rules in spec/features/transfer.md.
public let exportVersion = 1

public enum ImportMode: String, Codable, CaseIterable, Sendable {
    case merge, replace
}

public enum ExportFormat: String, Codable, CaseIterable, Sendable {
    case json, csv
}

public struct ImportResult: Codable, Equatable, Sendable {
    public var todos: [Todo]
    public var errors: [String]

    public init(todos: [Todo], errors: [String]) {
        self.todos = todos
        self.errors = errors
    }
}

public let csvColumns = ["id", "title", "completed", "priority", "dueDate", "notes", "createdAt", "updatedAt"]

private let timestampPattern = try! NSRegularExpression(
    pattern: #"^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,3})?Z$"#
)

/// UTC ISO-8601 like `2026-01-05T09:00:00.000Z` (milliseconds optional), with a real date and time.
public func isValidTimestamp(_ value: String) -> Bool {
    let ns = value as NSString
    guard let match = timestampPattern.firstMatch(in: value, range: NSRange(location: 0, length: ns.length)) else {
        return false
    }
    func number(_ index: Int) -> Int { Int(ns.substring(with: match.range(at: index))) ?? 99 }
    return isValidDueDate(ns.substring(with: match.range(at: 1))) && number(2) < 24 && number(3) < 60 && number(4) < 60
}

private struct TodoExport: Encodable {
    let version: Int
    let exportedAt: String
    let todos: [Todo]
}

public func exportTodosJson(_ todos: [Todo], now: Date = Date()) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
    let payload = TodoExport(version: exportVersion, exportedAt: Timestamp.iso(now), todos: todos)
    let data = (try? encoder.encode(payload)) ?? Data("{}".utf8)
    return String(decoding: data, as: UTF8.self)
}

private func csvCell(_ value: String?) -> String {
    let text = value ?? ""
    let needsQuotes = text.unicodeScalars.contains { $0 == "\"" || $0 == "," || $0 == "\n" || $0 == "\r" }
    return needsQuotes ? "\"\(text.replacingOccurrences(of: "\"", with: "\"\""))\"" : text
}

public func exportTodosCsv(_ todos: [Todo]) -> String {
    let rows = todos.map { todo in
        [todo.id, todo.title, todo.completed ? "true" : "false", todo.priority.rawValue, todo.dueDate, todo.notes, todo.createdAt, todo.updatedAt]
            .map(csvCell)
            .joined(separator: ",")
    }
    return ([csvColumns.joined(separator: ",")] + rows).joined(separator: "\n")
}

/// `todos-YYYY-MM-DD.<format>`, dated in UTC.
public func exportFileName(_ format: ExportFormat, now: Date = Date()) -> String {
    "todos-\(Timestamp.iso(now).prefix(10)).\(format.rawValue)"
}

private enum Checked {
    case valid(Todo)
    case invalid(String)
}

private func string(_ value: JSONValue?) -> String? {
    if case .string(let text)? = value { return text }
    return nil
}

private func isAbsent(_ value: JSONValue?) -> Bool { value == nil || value == .null }

private func validateTodo(_ value: JSONValue, index: Int) -> Checked {
    let at = "Item \(index + 1)"
    guard case .object(let fields) = value else { return .invalid("\(at): not an object") }
    guard let id = string(fields["id"]), !id.isEmpty else { return .invalid("\(at): missing id") }
    func fail(_ problem: String) -> Checked { .invalid("\(at) (\(id)): \(problem)") }
    guard let title = string(fields["title"]), isValidTitle(title) else { return fail("title must be 1-200 characters") }
    guard case .bool(let completed)? = fields["completed"] else { return fail("completed must be true/false") }
    guard let priority = string(fields["priority"]).flatMap(TodoPriority.init(rawValue:)) else {
        return fail("priority must be low, medium, or high")
    }
    let dueDate = string(fields["dueDate"])
    if !isAbsent(fields["dueDate"]), dueDate.map(isValidDueDate) != true { return fail("dueDate must be YYYY-MM-DD") }
    let notes = string(fields["notes"])
    if !isAbsent(fields["notes"]), notes == nil { return fail("notes must be text") }
    guard let createdAt = string(fields["createdAt"]), isValidTimestamp(createdAt) else { return fail("invalid createdAt") }
    let updatedAt = string(fields["updatedAt"]).flatMap { isValidTimestamp($0) ? $0 : nil } ?? createdAt
    return .valid(Todo(
        id: id,
        title: title.jsTrimmed,
        notes: notes?.isEmpty == false ? notes : nil,
        completed: completed,
        priority: priority,
        dueDate: dueDate?.isEmpty == false ? dueDate : nil,
        createdAt: createdAt,
        updatedAt: updatedAt
    ))
}

/// Accepts the `{ version, todos }` export envelope or a bare todo array; keeps valid items and reports the rest.
public func parseImportJson(_ raw: String) -> ImportResult {
    guard let parsed = try? JSONDecoder().decode(JSONValue.self, from: Data(raw.utf8)) else {
        return ImportResult(todos: [], errors: ["File is not valid JSON"])
    }
    let list: [JSONValue]
    switch parsed {
    case .array(let items): list = items
    case .object(let fields):
        guard case .array(let items)? = fields["todos"] else { fallthrough }
        list = items
    default: return ImportResult(todos: [], errors: ["Expected a list of todos"])
    }

    var todos: [Todo] = []
    var errors: [String] = []
    var seen = Set<String>()
    for (index, item) in list.enumerated() {
        switch validateTodo(item, index: index) {
        case .invalid(let error):
            errors.append(error)
        case .valid(let todo):
            if seen.insert(todo.id).inserted {
                todos.append(todo)
            } else {
                errors.append("Item \(index + 1) (\(todo.id)): duplicate id")
            }
        }
    }
    return ImportResult(todos: todos, errors: errors)
}

/// merge: imported rows overwrite same-id rows in place, new ones are appended. replace: the imported list wins.
public func applyImport(_ existing: [Todo], imported: [Todo], mode: ImportMode) -> [Todo] {
    if mode == .replace { return imported }
    let byId = Dictionary(imported.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    let known = Set(existing.map(\.id))
    return existing.map { byId[$0.id] ?? $0 } + imported.filter { !known.contains($0.id) }
}

private func plural(_ count: Int, _ noun: String) -> String { "\(count) \(count == 1 ? noun : "\(noun)s")" }

/// Confirmation text, e.g. "Found 1 valid todo and 2 problems."
public func describeImport(valid: Int, problems: Int) -> String {
    "Found \(valid) valid \(valid == 1 ? "todo" : "todos")\(problems > 0 ? " and \(plural(problems, "problem"))" : "")."
}

/// Status after confirming, e.g. "Imported 3 todos (merge)."
public func describeImported(count: Int, mode: ImportMode) -> String {
    "Imported \(plural(count, "todo")) (\(mode.rawValue))."
}
