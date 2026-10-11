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

    private var overdue: Bool { isOverdue(todo) }

    var body: some View {
        HStack(spacing: 10) {
            let toggleLabel = t(todo.completed ? "item.markActive" : "item.markComplete", ["title": todo.title])
            Toggle(toggleLabel,
                   isOn: Binding(get: { todo.completed }, set: { _ in onToggle() }))
            .toggleStyle(CheckboxToggleStyle())
            .accessibilityLabel(toggleLabel)
            .accessibilityIdentifier(TestID.itemToggle(todo.title))

            if editing {
                TextField(t("item.editTitle"), text: $draftTitle)
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
                    .accessibilityLabel(t("item.editTitle"))
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
                .accessibilityLabel(t("item.edit", ["title": todo.title]))
                .accessibilityIdentifier(TestID.itemTitle(todo.title))
            }

            if let dueDate = todo.dueDate {
                HStack(spacing: 0) {
                    if overdue {
                        Text(t("item.overdueBadge"))
                            .font(.system(size: 12, weight: .medium))
                            .accessibilityIdentifier(TestID.itemOverdue(todo.title))
                    }
                    Text(dueDate)
                        .font(.system(size: 12))
                        .accessibilityIdentifier(TestID.itemDueDate(todo.title))
                }
                .foregroundStyle(overdue ? Theme.danger : Theme.muted)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .layoutPriority(1)
                .accessibilityElement(children: .contain)
                .accessibilityLabel(t(overdue ? "item.overdue" : "item.due", ["date": dueDate]))
            }

            let colors = Theme.priority(todo.priority)
            Text(t("priority.\(todo.priority.rawValue)"))
                .font(.system(size: 12))
                .foregroundStyle(colors.text)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(colors.bg, in: Capsule())
                .fixedSize()
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
            .accessibilityLabel(t("item.delete", ["title": todo.title]))
            .accessibilityIdentifier(TestID.itemDelete(todo.title))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .cardStyle()
        .overlay {
            if overdue {
                RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.danger, lineWidth: 1)
            }
        }
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
