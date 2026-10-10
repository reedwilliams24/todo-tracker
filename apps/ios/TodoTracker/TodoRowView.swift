import SwiftUI
import TodoCore

struct TodoRowView: View {
    let todo: Todo
    let onToggle: () -> Void
    let onRename: (String) -> Void
    let onRemove: () -> Void

    @State private var editing = false
    @State private var draftTitle = ""
    @FocusState private var editFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Toggle("Mark \"\(todo.title)\" as \(todo.completed ? "active" : "complete")",
                   isOn: Binding(get: { todo.completed }, set: { _ in onToggle() }))
            .toggleStyle(CheckboxToggleStyle())
            .accessibilityLabel("Mark \"\(todo.title)\" as \(todo.completed ? "active" : "complete")")
            .accessibilityIdentifier(TestID.itemToggle(todo.title))

            if editing {
                TextField("Edit title", text: $draftTitle)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.foreground)
                    .padding(.vertical, 4)
                    .focused($editFocused)
                    .submitLabel(.done)
                    .onSubmit(commit)
                    .onChange(of: editFocused) { _, focused in
                        if !focused { commit() }
                    }
                    .onAppear { editFocused = true }
                    .accessibilityLabel("Edit title")
                    .accessibilityIdentifier(TestID.itemEditInput)
            } else {
                Button {
                    draftTitle = todo.title
                    editing = true
                } label: {
                    Text(todo.title)
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.foreground)
                        .strikethrough(todo.completed)
                        .opacity(todo.completed ? 0.5 : 1)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit \"\(todo.title)\"")
                .accessibilityIdentifier(TestID.itemTitle(todo.title))
            }

            if let dueDate = todo.dueDate {
                Text(dueDate)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                    .accessibilityIdentifier(TestID.itemDueDate(todo.title))
            }

            let colors = Theme.priority(todo.priority)
            Text(todo.priority.rawValue.capitalized)
                .font(.system(size: 12))
                .foregroundStyle(colors.text)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(colors.bg, in: Capsule())
                .accessibilityIdentifier(TestID.itemPriority(todo.title))

            Button(action: onRemove) {
                Text("×")
                    .font(.system(size: 18))
                    .foregroundStyle(Theme.muted)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Delete \"\(todo.title)\"")
            .accessibilityIdentifier(TestID.itemDelete(todo.title))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .cardStyle()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(TestID.item(todo.title))
    }

    private func commit() {
        guard editing else { return }
        if isValidTitle(draftTitle), draftTitle.jsTrimmedTitle != todo.title {
            onRename(draftTitle)
        }
        editing = false
    }
}

/// The RN app's square checkbox; keeps Toggle semantics (value 0/1) for accessibility.
private struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            RoundedRectangle(cornerRadius: Theme.Radius.sm)
                .strokeBorder(Theme.foreground, lineWidth: 1.5)
                .background(
                    RoundedRectangle(cornerRadius: Theme.Radius.sm)
                        .fill(configuration.isOn ? Theme.foreground : .clear)
                )
                .overlay {
                    if configuration.isOn {
                        Text("✓").font(.system(size: 12)).foregroundStyle(Theme.card)
                    }
                }
                .frame(width: 20, height: 20)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(configuration.isOn ? "1" : "0")
        .accessibilityAddTraits(.isToggle)
    }
}

private extension String {
    var jsTrimmedTitle: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
