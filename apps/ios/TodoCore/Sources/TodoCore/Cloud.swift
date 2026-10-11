import Foundation

/// Public Supabase config; `nil` from `cloudConfig` means "cloud disabled, stay local-only".
public struct CloudConfig: Codable, Equatable, Sendable {
    public let url: String
    public let anonKey: String

    public init(url: String, anonKey: String) {
        self.url = url
        self.anonKey = anonKey
    }
}

public func cloudConfig(url: String?, anonKey: String?) -> CloudConfig? {
    guard let url, !url.isEmpty, let anonKey, !anonKey.isEmpty else { return nil }
    return CloudConfig(url: url, anonKey: anonKey)
}

/// Row shape of the `todos` table (see supabase/migrations).
public struct TodoRow: Codable, Equatable, Sendable {
    public var id: String
    public var userId: String
    public var data: Todo
    public var completed: Bool
    public var dueDate: String?
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, data, completed
        case userId = "user_id"
        case dueDate = "due_date"
        case updatedAt = "updated_at"
    }

    public init(id: String, userId: String, data: Todo, completed: Bool, dueDate: String?, updatedAt: String) {
        self.id = id
        self.userId = userId
        self.data = data
        self.completed = completed
        self.dueDate = dueDate
        self.updatedAt = updatedAt
    }

    /// `due_date` is an explicit null so an upsert clears a removed due date.
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(userId, forKey: .userId)
        try container.encode(data, forKey: .data)
        try container.encode(completed, forKey: .completed)
        try container.encode(dueDate, forKey: .dueDate)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

public func toRow(_ todo: Todo, userId: String) -> TodoRow {
    TodoRow(id: todo.id, userId: userId, data: todo, completed: todo.completed, dueDate: todo.dueDate, updatedAt: todo.updatedAt)
}

public func fromRow(_ row: TodoRow) -> Todo { row.data }

/// Last-synced `updatedAt` per todo id, in list order.
public struct CloudVersion: Codable, Equatable, Sendable {
    public var id: String
    public var updatedAt: String

    public init(id: String, updatedAt: String) {
        self.id = id
        self.updatedAt = updatedAt
    }
}

public struct CloudSavePlan: Codable, Equatable, Sendable {
    public var changed: [Todo]
    public var removed: [String]
}

public func cloudVersions(_ todos: [Todo]) -> [CloudVersion] {
    todos.map { CloudVersion(id: $0.id, updatedAt: $0.updatedAt) }
}

/// Upsert new or changed todos, delete last-synced ids that are gone.
public func planCloudSave(known: [CloudVersion], todos: [Todo]) -> CloudSavePlan {
    let versions = Dictionary(known.map { ($0.id, $0.updatedAt) }, uniquingKeysWith: { _, last in last })
    let ids = Set(todos.map(\.id))
    return CloudSavePlan(
        changed: todos.filter { versions[$0.id] != $0.updatedAt },
        removed: known.map(\.id).filter { !ids.contains($0) }
    )
}

/// Per-account flag key recording that the signed-out list was merged in on this device.
public func migrationKey(userId: String) -> String { "todo-tracker:migrated:\(userId)" }

/// Account order first, local-only todos appended; a local copy wins only if strictly newer.
public func mergeLocalIntoAccount(local: [Todo], remote: [Todo]) -> [Todo] {
    var merged = remote
    var index = [String: Int]()
    for (position, todo) in merged.enumerated() where index[todo.id] == nil { index[todo.id] = position }
    for todo in local {
        if let position = index[todo.id] {
            if merged[position].updatedAt < todo.updatedAt { merged[position] = todo }
        } else {
            index[todo.id] = merged.count
            merged.append(todo)
        }
    }
    return merged
}
