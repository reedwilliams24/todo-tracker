import Foundation

public let storageKey = "todo-tracker:todos:v1"

/// JSON array of todos in storage order (newest first); see spec/schema/storage.schema.json.
public func serializeTodos(_ todos: [Todo]) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.withoutEscapingSlashes]
    let data = (try? encoder.encode(todos)) ?? Data("[]".utf8)
    return String(decoding: data, as: UTF8.self)
}

/// Missing, empty, corrupt or non-array values load as an empty list.
public func parseStoredTodos(_ raw: String?) -> [Todo] {
    guard let raw, !raw.isEmpty else { return [] }
    return (try? JSONDecoder().decode([Todo].self, from: Data(raw.utf8))) ?? []
}
