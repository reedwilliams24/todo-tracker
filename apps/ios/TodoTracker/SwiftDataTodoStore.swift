import Foundation
import SwiftData
import TodoCore

@MainActor
protocol TodoStore {
    func load() -> [Todo]
    func save(_ todos: [Todo])
}

/// One row per todo; `position` keeps the list order the reducer produced.
@Model
final class StoredTodo {
    @Attribute(.unique) var id: String
    var position: Int
    var title: String
    var notes: String?
    var completed: Bool
    var priority: String
    var dueDate: String?
    var createdAt: String
    var updatedAt: String

    init(_ todo: Todo, position: Int) {
        id = todo.id
        self.position = position
        title = todo.title
        notes = todo.notes
        completed = todo.completed
        priority = todo.priority.rawValue
        dueDate = todo.dueDate
        createdAt = todo.createdAt
        updatedAt = todo.updatedAt
    }

    func update(_ todo: Todo, position: Int) {
        self.position = position
        title = todo.title
        notes = todo.notes
        completed = todo.completed
        priority = todo.priority.rawValue
        dueDate = todo.dueDate
        createdAt = todo.createdAt
        updatedAt = todo.updatedAt
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
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

@MainActor
final class SwiftDataTodoStore: TodoStore {
    private let context: ModelContext

    init(context: ModelContext) {
        self.context = context
    }

    static func makeContainer(inMemory: Bool) -> ModelContainer {
        do {
            let config = ModelConfiguration(isStoredInMemoryOnly: inMemory)
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
