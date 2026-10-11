import Foundation
import Observation
import TodoCore

/// Drives the TodoCore reducer, persists list changes and expires the undo toast.
@MainActor
@Observable
final class TodoViewModel {
    private(set) var state = TodoState.initial
    var filter: TodoFilter = .all
    var sort: TodoSort = .priority
    var selecting = false
    var selectedIds: Set<String> = []
    var confirmingDelete = false

    private let store: TodoStore
    private let now: () -> Date
    private var expiry: Task<Void, Never>?

    init(store: TodoStore, now: @escaping () -> Date = Date.init) {
        self.store = store
        self.now = now
        state = reduceTodos(state, .load(store.load()), now: now())
    }

    var visibleTodos: [Todo] { sortTodos(filterTodos(state.todos, filter), sort) }
    var remaining: Int { countRemaining(state.todos) }
    var completedCount: Int { countCompleted(state.todos) }
    var selected: [String] { visibleTodos.map(\.id).filter(selectedIds.contains) }
    var allVisibleSelected: Bool { !visibleTodos.isEmpty && selected.count == visibleTodos.count }
    var remainingText: String { t("list.remaining", ["count": remaining]) }
    var undoLabel: String? { state.undoable?.label }
    var stats: TodoStats { computeStats(state.todos, now: now()) }
    var emptyText: String {
        state.todos.isEmpty ? t("list.empty") : t("list.emptyFiltered", ["filter": filter.rawValue])
    }

    func add(_ draft: TodoDraft) {
        dispatch(.prepend(addTodos([], drafts: [draft], now: now()).created))
    }

    func toggle(_ id: String) { dispatch(.toggle(id: id)) }
    func rename(_ id: String, title: String) { dispatch(.rename(id: id, title: title)) }
    func remove(_ id: String) { dispatch(.remove(ids: [id])) }
    func clearCompleted() { dispatch(.clearCompleted) }

    func toggleSelectMode() {
        if selecting { exitSelectMode() } else { selecting = true }
    }

    func toggleSelected(_ id: String) {
        if selectedIds.contains(id) { selectedIds.remove(id) } else { selectedIds.insert(id) }
    }

    func toggleSelectAll() {
        selectedIds = allVisibleSelected ? [] : Set(visibleTodos.map(\.id))
    }

    func toggleSelectedComplete() {
        dispatch(.toggleMany(ids: selected))
        exitSelectMode()
    }

    func deleteSelected() {
        dispatch(.remove(ids: selected))
        exitSelectMode()
    }

    private func exitSelectMode() {
        selecting = false
        selectedIds = []
        confirmingDelete = false
    }
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
