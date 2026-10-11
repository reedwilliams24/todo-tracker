import Foundation
import SwiftData
import TodoCore

/// Kind of the "Today" home-screen widget, so the app can ask WidgetKit to redraw it.
let todayWidgetKind = "TodayWidget"

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
