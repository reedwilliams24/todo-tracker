import Foundation
import SwiftData
import TodoCore

@MainActor
protocol TodoStore {
    func load() -> [Todo]
    func save(_ todos: [Todo])
}

/// One row per todo; `position` keeps the list order the reducer produced.
/// `subtasksJSON` holds the `subtasks` array from spec/schema/todo.schema.json, or nil when there are none.
@Model
final class StoredTodo {
    @Attribute(.unique) var id: String
    var position: Int
    var title: String
    var notes: String?
    var completed: Bool
    var priority: String
    var dueDate: String?
    /// `ReminderOffset` raw value; optional, so existing stores migrate automatically.
    var reminder: String?
    var recurrence: String?
    var createdAt: String
    var updatedAt: String
    var completedAt: String?
    var subtasksJSON: String?

    init(_ todo: Todo, position: Int) {
        id = todo.id
        self.position = position
        title = todo.title
        notes = todo.notes
        completed = todo.completed
        priority = todo.priority.rawValue
        dueDate = todo.dueDate
        reminder = todo.reminder?.rawValue
        recurrence = todo.recurrence?.rawValue
        createdAt = todo.createdAt
        updatedAt = todo.updatedAt
        completedAt = todo.completedAt
        subtasksJSON = Self.encode(todo.subtasks)
    }

    func update(_ todo: Todo, position: Int) {
        self.position = position
        title = todo.title
        notes = todo.notes
        completed = todo.completed
        priority = todo.priority.rawValue
        dueDate = todo.dueDate
        reminder = todo.reminder?.rawValue
        recurrence = todo.recurrence?.rawValue
        createdAt = todo.createdAt
        updatedAt = todo.updatedAt
        completedAt = todo.completedAt
        subtasksJSON = Self.encode(todo.subtasks)
    }

    var todo: Todo? {
        guard let priority = TodoPriority(rawValue: priority) else { return nil }
        return Todo(
            id: id,
            title: title,
            notes: notes,
            completed: completed,
            priority: priority,
            dueDate: dueDate,
            reminder: reminder.flatMap(ReminderOffset.init(rawValue:)),
            recurrence: recurrence.flatMap(Recurrence.init(rawValue:)),
            createdAt: createdAt,
            updatedAt: updatedAt,
            completedAt: completedAt,
            subtasks: subtasksJSON.flatMap { try? JSONDecoder().decode([Subtask].self, from: Data($0.utf8)) }
        )
    }

    private static func encode(_ subtasks: [Subtask]?) -> String? {
        guard let subtasks, !subtasks.isEmpty, let data = try? JSONEncoder().encode(subtasks) else { return nil }
        return String(bytes: data, encoding: .utf8)
    }
}

@MainActor
final class SwiftDataTodoStore: TodoStore {
    private let context: ModelContext

    init(context: ModelContext) {
        self.context = context
    }

    /// `name` picks the store: the default is the guest list, `account` the signed-in account's local cache.
    static func makeContainer(inMemory: Bool, name: String? = nil) -> ModelContainer {
        do {
            let config =
                name.map { ModelConfiguration($0, isStoredInMemoryOnly: inMemory) }
                ?? ModelConfiguration(isStoredInMemoryOnly: inMemory)
            return try ModelContainer(for: StoredTodo.self, configurations: config)
        } catch {
            fatalError("Could not open the todo store: \(error)")
        }
    }

    func load() -> [Todo] {
        let descriptor = FetchDescriptor<StoredTodo>(sortBy: [SortDescriptor(\.position)])
        return ((try? context.fetch(descriptor)) ?? []).compactMap(\.todo)
    }

    func save(_ todos: [Todo]) {
        let rows = (try? context.fetch(FetchDescriptor<StoredTodo>())) ?? []
        var existing = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for (position, todo) in todos.enumerated() {
            if let row = existing.removeValue(forKey: todo.id) {
                row.update(todo, position: position)
            } else {
                context.insert(StoredTodo(todo, position: position))
            }
        }
        existing.values.forEach(context.delete)
        try? context.save()
    }
}
