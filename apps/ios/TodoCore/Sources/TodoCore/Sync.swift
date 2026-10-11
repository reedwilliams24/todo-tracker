import Foundation

/// One row of the backend `todos` table (spec/features/sync.md). Timestamps use the Todo format.
public struct TodoRow: Codable, Equatable, Hashable, Sendable {
    public var id: String
    public var userId: String
    public var title: String
    public var notes: String?
    public var completed: Bool
    public var priority: TodoPriority
    public var dueDate: String?
    public var recurrence: Recurrence?
    public var completedAt: String?
    public var createdAt: String
    public var updatedAt: String
    /// Tombstone: set when the todo was deleted.
    public var deletedAt: String?
    /// Assigned by the server on every write; nil on rows the client hasn't pushed yet.
    public var serverSeq: Int64?

    public init(
        id: String,
        userId: String,
        title: String,
        notes: String? = nil,
        completed: Bool = false,
        priority: TodoPriority = defaultPriority,
        dueDate: String? = nil,
        recurrence: Recurrence? = nil,
        completedAt: String? = nil,
        createdAt: String,
        updatedAt: String,
        deletedAt: String? = nil,
        serverSeq: Int64? = nil
    ) {
        self.id = id
        self.userId = userId
        self.title = title
        self.notes = notes
        self.completed = completed
        self.priority = priority
        self.dueDate = dueDate
        self.recurrence = recurrence
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
        self.serverSeq = serverSeq
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case id
        case userId = "user_id"
        case title
        case notes
        case completed
        case priority
        case dueDate = "due_date"
        case recurrence
        case completedAt = "completed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
        case serverSeq = "server_seq"
    }

    /// Writes every column, nulls included, so a push can clear a field.
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(userId, forKey: .userId)
        try container.encode(title, forKey: .title)
        try container.encode(notes, forKey: .notes)
        try container.encode(completed, forKey: .completed)
        try container.encode(priority, forKey: .priority)
        try container.encode(dueDate, forKey: .dueDate)
        try container.encode(recurrence, forKey: .recurrence)
        try container.encode(completedAt, forKey: .completedAt)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encode(deletedAt, forKey: .deletedAt)
        try container.encode(serverSeq, forKey: .serverSeq)
    }
}

public let syncColumns: [String] = TodoRow.CodingKeys.allCases.map(\.rawValue)

/// The row to push for a todo. `deletedAt` turns it into a tombstone. `reminder` is device-local and not synced.
public func toRow(_ todo: Todo, userId: String, deletedAt: Date? = nil) -> TodoRow {
    TodoRow(
        id: todo.id,
        userId: userId,
        title: todo.title,
        notes: todo.notes,
        completed: todo.completed,
        priority: todo.priority,
        dueDate: todo.dueDate,
        recurrence: todo.recurrence,
        completedAt: todo.completedAt,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        deletedAt: deletedAt.map(Timestamp.iso),
        serverSeq: nil
    )
}

public func fromRow(_ row: TodoRow) -> Todo {
    Todo(
        id: row.id,
        title: row.title,
        notes: row.notes,
        completed: row.completed,
        priority: row.priority,
        dueDate: row.dueDate,
        recurrence: row.recurrence,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        completedAt: row.completedAt
    )
}

/// Applies pulled or Realtime rows to the local list. Rows at or below `cursor` are ignored, tombstones remove the
/// todo, and otherwise the newer `updated_at` wins (ties go to the server) against both the local copy and any
/// in-flight push for that todo.
public func applyRemote(_ local: [Todo], inFlight: [Todo], rows: [TodoRow], cursor: Int64) -> [Todo] {
    let pending = Dictionary(inFlight.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    var todos = local
    for row in rows {
        guard let seq = row.serverSeq, seq > cursor else { continue }
        let index = todos.firstIndex { $0.id == row.id }
        if row.deletedAt != nil {
            if let index { todos.remove(at: index) }
            continue
        }
        if let mine = pending[row.id], mine.updatedAt > row.updatedAt { continue }
        let current = index.map { todos[$0] }
        if let current, current.updatedAt > row.updatedAt { continue }
        var incoming = fromRow(row)
        if let reminder = current?.reminder, incoming.dueDate != nil { incoming.reminder = reminder }
        if let subtasks = current?.subtasks { incoming.subtasks = subtasks }
        if let index { todos[index] = incoming } else { todos.insert(incoming, at: 0) }
    }
    return todos
}

/// The highest `server_seq` seen; never moves backwards.
public func advanceCursor(_ cursor: Int64, rows: [TodoRow]) -> Int64 {
    rows.compactMap(\.serverSeq).reduce(cursor, max)
}

/// Undoes the local effect of a failed push. `before` is the list as it was before the edit. A failed todo goes back
/// to its `before` version, is removed if it was new, or is put back where it was if its delete failed.
public func rollbackPush(_ local: [Todo], before: [Todo], failedIds: [String]) -> [Todo] {
    let failed = Set(failedIds)
    let prior = Dictionary(before.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    var todos: [Todo] = []
    for todo in local {
        if !failed.contains(todo.id) {
            todos.append(todo)
        } else if let restored = prior[todo.id] {
            todos.append(restored)
        }
    }
    for (i, todo) in before.enumerated() {
        guard failed.contains(todo.id), !todos.contains(where: { $0.id == todo.id }) else { continue }
        var at = 0
        for j in stride(from: i - 1, through: 0, by: -1) {
            if let k = todos.firstIndex(where: { $0.id == before[j].id }) {
                at = k + 1
                break
            }
        }
        todos.insert(todo, at: at)
    }
    return todos
}

/// Rows for the sign-in "Move" choice: every guest todo becomes a new account row with a fresh id, so it never
/// overwrites an account todo. Its fields are kept and `updated_at` is the time of the move.
public func guestToRows(_ guest: [Todo], userId: String, now: Date) -> [TodoRow] {
    let stamp = Timestamp.iso(now)
    return guest.map { todo in
        var row = toRow(todo, userId: userId)
        row.id = generateId()
        row.updatedAt = stamp
        return row
    }
}

/// A local edit ready to push: the list to show and the rows to send (spec/features/sync.md#push).
public struct PushPlan: Equatable, Sendable {
    public var todos: [Todo]
    public var rows: [TodoRow]
}

/// Turns a local edit (`before` -> `after`) into rows to push. Added or changed todos become rows, removed ones
/// tombstones. A change that doesn't move `updated_at` forward (an undo) is stamped `now` so it wins LWW, and a todo
/// brought back after its tombstone was pushed (`tombstoned`) gets a fresh id, since tombstones always win.
public func planPush(_ before: [Todo], after: [Todo], tombstoned: Set<String>, userId: String, now: Date) -> PushPlan {
    let stamp = Timestamp.iso(now)
    let prior = Dictionary(before.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    let kept = Set(after.map(\.id))
    var rows: [TodoRow] = []
    let todos = after.map { todo -> Todo in
        var next = todo
        if let prev = prior[todo.id] {
            if toRow(prev, userId: userId) == toRow(todo, userId: userId) { return todo }
            if todo.updatedAt <= prev.updatedAt { next.updatedAt = stamp }
        } else if tombstoned.contains(todo.id) {
            next.id = generateId()
            next.updatedAt = stamp
        }
        rows.append(toRow(next, userId: userId))
        return next
    }
    for prev in before where !kept.contains(prev.id) {
        var gone = prev
        gone.updatedAt = stamp
        rows.append(toRow(gone, userId: userId, deletedAt: now))
    }
    return PushPlan(todos: todos, rows: rows)
}
