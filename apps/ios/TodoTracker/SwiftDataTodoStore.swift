import Foundation
import SwiftData
import TodoCore
import WidgetKit

@MainActor
protocol TodoStore {
    func load() -> [Todo]
    func save(_ todos: [Todo])
}

@MainActor
final class SwiftDataTodoStore: TodoStore {
    private let context: ModelContext
    /// The widget reads the on-disk store, so in-memory stores (UI tests) don't reload it.
    private let reloadsWidget: Bool

    init(context: ModelContext) {
        self.context = context
        reloadsWidget = context.container.configurations.contains { !$0.isStoredInMemoryOnly }
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
        if reloadsWidget { WidgetCenter.shared.reloadTimelines(ofKind: todayWidgetKind) }
    }
}
