import SwiftUI
import TodoCore

struct ContentView: View {
    @Bindable var model: TodoViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Todo Tracker")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(Theme.foreground)
                    Text("A tiny local-first todo list.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.muted)
                }
                TodoFormView(onAdd: model.add)
                toolbar
                sortControl
                if model.selecting { bulkBar }
                list
                Text(model.remainingText)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                    .accessibilityIdentifier(TestID.remaining)
            }
            .padding(16)
            .padding(.bottom, 72)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.immediately)
        .background(Theme.background)
        .contentShape(Rectangle())
        // Like RN's keyboardShouldPersistTaps="handled": tapping empty space blurs the focused field (committing a rename).
        .onTapGesture {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
        .overlay(alignment: .bottom) { toast }
        .animation(.easeOut(duration: 0.15), value: model.undoLabel)
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            HStack(spacing: 4) {
                ForEach(TodoFilter.allCases, id: \.self) { option in
                    let selected = model.filter == option
                    Button { model.filter = option } label: {
                        Text(option.rawValue.capitalized)
                            .font(.system(size: 14))
                            .foregroundStyle(selected ? Theme.card : Theme.foreground.opacity(0.7))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 4)
                            .background(selected ? Theme.foreground : .clear, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .accessibilityIdentifier(TestID.filter(option))
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Filter todos")
            Spacer()
            if !model.state.todos.isEmpty {
                Button(model.selecting ? "Done" : "Select", action: model.toggleSelectMode)
                    .buttonStyle(.plain)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground.opacity(0.7))
                    .accessibilityIdentifier(TestID.selectMode)
            }
            if model.completedCount > 0, !model.selecting {
                Button("Clear completed (\(model.completedCount))", action: model.clearCompleted)
                    .buttonStyle(.plain)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground.opacity(0.7))
                    .accessibilityIdentifier(TestID.clearCompleted)
            }
        }
    }

    private var sortControl: some View {
        HStack(spacing: 4) {
            Text("Sort")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .padding(.trailing, 4)
            ForEach(TodoSort.allCases, id: \.self) { option in
                let selected = model.sort == option
                Button { model.sort = option } label: {
                    Text(option == .due ? "Due date" : "Priority")
                        .font(.system(size: 14))
                        .foregroundStyle(selected ? Theme.card : Theme.foreground.opacity(0.7))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(selected ? Theme.foreground : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier(TestID.sortOption(option))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Sort todos")
        .accessibilityIdentifier(TestID.sort)
    }

    private var bulkBar: some View {
        let count = model.selected.count
        return HStack(spacing: 12) {
            if model.confirmingDelete {
                Text("Delete \(count) \(count == 1 ? "todo" : "todos")?")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.foreground)
                Spacer()
                actionButton("Cancel", id: TestID.bulkDeleteCancel) { model.confirmingDelete = false }
                actionButton("Delete", id: TestID.bulkDeleteConfirm, danger: true, action: model.deleteSelected)
            } else {
                Text("\(count) selected")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .accessibilityIdentifier(TestID.selectedCount)
                Button(model.allVisibleSelected ? "Select none" : "Select all", action: model.toggleSelectAll)
                    .buttonStyle(.plain)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground)
                    .accessibilityIdentifier(TestID.selectAll)
                Spacer()
                actionButton("Toggle complete", id: TestID.bulkToggle, enabled: count > 0, action: model.toggleSelectedComplete)
                actionButton("Delete", id: TestID.bulkDelete, enabled: count > 0, danger: true) { model.confirmingDelete = true }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .cardStyle()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Bulk actions")
        .accessibilityIdentifier(TestID.bulkBar)
    }

    private func actionButton(
        _ title: String, id: String, enabled: Bool = true, danger: Bool = false, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(danger ? Theme.card : Theme.foreground)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(danger ? Theme.danger : Theme.card, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).strokeBorder(danger ? Theme.danger : Theme.border))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityIdentifier(id)
    }

    @ViewBuilder
    private var list: some View {
        let todos = model.visibleTodos
        if todos.isEmpty {
            Text(model.emptyText)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .accessibilityIdentifier(TestID.empty)
        } else {
            LazyVStack(spacing: 8) {
                ForEach(todos) { todo in
                    TodoRowView(
                        todo: todo,
                        onToggle: { model.toggle(todo.id) },
                        onRename: { model.rename(todo.id, title: $0) },
                        onRemove: { model.remove(todo.id) },
                        selection: model.selecting
                            ? TodoRowView.Selection(selected: model.selectedIds.contains(todo.id), onSelect: { model.toggleSelected(todo.id) })
                            : nil
                    )
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(TestID.list)
        }
    }

    @ViewBuilder
    private var toast: some View {
        if let label = model.undoLabel {
            HStack(spacing: 16) {
                Text(label)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.card)
                    .accessibilityIdentifier(TestID.undoLabel)
                Button(action: model.undo) {
                    Text("Undo")
                        .font(.system(size: 14, weight: .semibold))
                        .underline()
                        .foregroundStyle(Theme.card)
                        .padding(8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(-8)
                .accessibilityIdentifier(TestID.undoAction)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Theme.foreground, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .padding(.bottom, 24)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(TestID.undoToast)
        }
    }
}
