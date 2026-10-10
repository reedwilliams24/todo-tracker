import Foundation
import Observation
import TodoCore

/// Drives the TodoCore reducer, persists list changes and expires the undo toast.
@MainActor
@Observable
final class TodoViewModel {
    private(set) var state = TodoState.initial
    var filter: TodoFilter = .all

    private let store: TodoStore
    private let now: () -> Date
    private var expiry: Task<Void, Never>?

    init(store: TodoStore, now: @escaping () -> Date = Date.init) {
        self.store = store
        self.now = now
        state = reduceTodos(state, .load(store.load()), now: now())
    }

    var visibleTodos: [Todo] { sortByPriority(filterTodos(state.todos, filter)) }
    var remaining: Int { countRemaining(state.todos) }
    var hasCompleted: Bool { state.todos.count > remaining }
    var remainingText: String { "\(remaining) \(remaining == 1 ? "task" : "tasks") remaining" }
    var undoLabel: String? { state.undoable?.label }
    var emptyText: String {
        state.todos.isEmpty ? "No todos yet. Add your first one above." : "No \(filter.rawValue) todos."
    }

    func add(_ draft: TodoDraft) {
        dispatch(.prepend(addTodos([], drafts: [draft], now: now()).created))
    }

    func toggle(_ id: String) { dispatch(.toggle(id: id)) }
    func rename(_ id: String, title: String) { dispatch(.rename(id: id, title: title)) }
    func remove(_ id: String) { dispatch(.remove(ids: [id])) }
    func clearCompleted() { dispatch(.clearCompleted) }
    func undo() { dispatch(.undo) }

    private func dispatch(_ action: TodoAction) {
        let previous = state
        state = reduceTodos(state, action, now: now())
        if state.todos != previous.todos { store.save(state.todos) }
        if state.undoable != previous.undoable { scheduleExpiry() }
    }

    private func scheduleExpiry() {
        expiry?.cancel()
        guard let entry = state.undoable else { return }
        let delay = max(0, entry.at + undoTimeoutMs - Timestamp.milliseconds(now()))
        expiry = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(delay))
            guard !Task.isCancelled else { return }
            self?.dispatch(.expireUndo)
        }
    }
}
