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
                        .accessibilityAddTraits(.isHeader)
                    Text("A tiny local-first todo list.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.muted)
                }
                TodoFormView(onAdd: model.add)
                toolbar
                sortControl
                list
                Text(model.remainingText)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                    .accessibilityIdentifier(TestID.remaining)
                    // Like aria-live="polite" on web: VoiceOver reads the new count after toggles and deletes.
                    .onChange(of: model.remainingText) { _, text in
                        UIAccessibility.post(notification: .announcement, argument: text)
                    }
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
            if model.hasCompleted {
                Button("Clear completed", action: model.clearCompleted)
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
                        onRemove: { model.remove(todo.id) }
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
