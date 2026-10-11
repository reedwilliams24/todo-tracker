import SwiftUI
import TodoCore

struct TodoRowView: View {
    let todo: Todo
    let onToggle: () -> Void
    let onRename: (String) -> Void
    let onRemove: () -> Void
    let onAddSubtask: (String) -> Void
    let onToggleSubtask: (String) -> Void
    let onRemoveSubtask: (String) -> Void
    var selection: Selection?
    /// False while the list is read-only (spec/features/realtime.md#connection-status); expanding still works.
    var editable = true

    struct Selection {
        let selected: Bool
        let onSelect: () -> Void
    }

    @State private var expanded = false
    @State private var subtaskTitle = ""
    @State private var editing = false
    @State private var draftTitle = ""
    @FocusState private var editFocused: Bool

    private var overdue: Bool { isOverdue(todo) }

    var body: some View {
        if let selection {
            selectableRow(selection)
        } else {
            row
        }
    }

    private func selectableRow(_ selection: Selection) -> some View {
        Button(action: selection.onSelect) {
            HStack(spacing: 10) {
                Circle()
                    .strokeBorder(Theme.foreground, lineWidth: 1.5)
                    .background(Circle().fill(selection.selected ? Theme.foreground : .clear))
                    .overlay {
                        if selection.selected {
                            Text("✓").font(.system(size: 12)).foregroundStyle(Theme.card)
                        }
                    }
                    .frame(width: 20, height: 20)
                    .accessibilityLabel(t("select.item", ["title": todo.title]))
                    .accessibilityValue(selection.selected ? "1" : "0")
                    .accessibilityAddTraits(.isToggle)
                    .accessibilityIdentifier(TestID.itemSelect(todo.title))
                Text(todo.title)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.foreground)
                    .strikethrough(todo.completed)
                    .opacity(todo.completed ? 0.5 : 1)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                let colors = Theme.priority(todo.priority)
                Text(todo.priority.rawValue.capitalized)
                    .font(.system(size: 12))
                    .foregroundStyle(colors.text)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(colors.bg, in: Capsule())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .cardStyle()
        .overlay {
            if selection.selected {
                RoundedRectangle(cornerRadius: Theme.Radius.lg).strokeBorder(Theme.foreground, lineWidth: 1.5)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(TestID.item(todo.title))
    }

    private var row: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if expanded { subtaskPanel }
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

    private var header: some View {
        HStack(spacing: 10) {
            let toggleLabel = t(todo.completed ? "item.markActive" : "item.markComplete", ["title": todo.title])
            Toggle(
                toggleLabel,
                isOn: Binding(get: { todo.completed }, set: { _ in onToggle() })
            )
            .toggleStyle(CheckboxToggleStyle())
            .accessibilityLabel(toggleLabel)
            .disabled(!editable)
            .accessibilityIdentifier(TestID.itemToggle(todo.title))

            VStack(alignment: .leading, spacing: 2) {
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
                            .opacity(todo.completed ? 0.7 : 1)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(t("item.edit", ["title": todo.title]))
                    .accessibilityHint(t("item.editA11yHint"))
                    .disabled(!editable)
                    .accessibilityIdentifier(TestID.itemTitle(todo.title))
                }

                if todo.dueDate != nil || todo.recurrence != nil {
                    HStack(spacing: 8) {
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
                        if let recurrence = todo.recurrence {
                            Text(t("item.recurrence", ["label": t("recurrence.\(recurrence.rawValue)")]))
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.muted)
                                .lineLimit(1)
                                .fixedSize()
                                .accessibilityIdentifier(TestID.itemRecurrence(todo.title))
                        }
                        if let reminder = todo.reminder {
                            Text(t("reminder.\(reminder.rawValue)"))
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.muted)
                                .lineLimit(1)
                                .fixedSize()
                                .accessibilityHint(t("form.reminder.label"))
                                .accessibilityIdentifier(TestID.itemReminder(todo.title))
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            let progress = subtaskProgress(todo)
            Button {
                expanded.toggle()
            } label: {
                HStack(spacing: 4) {
                    Text(progress.total > 0 ? progress.label : "+")
                        .font(.system(size: 12).monospacedDigit())
                        .foregroundStyle(Theme.foreground)
                        .accessibilityIdentifier(TestID.itemSubtaskProgress(todo.title))
                    Text(expanded ? "▾" : "▸")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Theme.border, in: Capsule())
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .fixedSize()
            .accessibilityElement(children: .contain)
            .accessibilityLabel(t(expanded ? "subtasks.collapse" : "subtasks.expand", ["title": todo.title]))
            .accessibilityIdentifier(TestID.itemSubtasksToggle(todo.title))

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
            .disabled(!editable)
            .accessibilityIdentifier(TestID.itemDelete(todo.title))
        }
    }

    private var subtaskPanel: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(todo.subtasks ?? []) { subtask in
                HStack(spacing: 8) {
                    let toggleLabel = t(
                        subtask.completed ? "subtask.markActive" : "subtask.markComplete", ["title": subtask.title])
                    Toggle(
                        toggleLabel,
                        isOn: Binding(get: { subtask.completed }, set: { _ in onToggleSubtask(subtask.id) })
                    )
                    .toggleStyle(CheckboxToggleStyle(size: 16))
                    .accessibilityLabel(toggleLabel)
                    .disabled(!editable)
                    .accessibilityIdentifier(TestID.subtaskToggle(subtask.title))

                    Text(subtask.title)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.foreground)
                        .strikethrough(subtask.completed)
                        .opacity(subtask.completed ? 0.5 : 1)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Button {
                        onRemoveSubtask(subtask.id)
                    } label: {
                        Text("×")
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.muted)
                            .padding(.horizontal, 6)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(t("subtask.delete", ["title": subtask.title]))
                    .disabled(!editable)
                    .accessibilityIdentifier(TestID.subtaskDelete(subtask.title))
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier(TestID.subtask(subtask.title))
            }

            TextField(t("subtasks.add.placeholder"), text: $subtaskTitle)
                .font(.system(size: 14))
                .foregroundStyle(Theme.foreground)
                .padding(.vertical, 4)
                .submitLabel(.done)
                .onSubmit(submitSubtask)
                .accessibilityLabel(t("subtasks.add.label", ["title": todo.title]))
                .disabled(!editable)
                .accessibilityIdentifier(TestID.subtaskInput(todo.title))
        }
        .padding(.leading, 30)
    }

    private func submitSubtask() {
        guard isValidTitle(subtaskTitle) else { return }
        onAddSubtask(subtaskTitle)
        subtaskTitle = ""
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
    var size: CGFloat = 20

    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
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
                .frame(width: size, height: size)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(configuration.isOn ? "1" : "0")
        .accessibilityAddTraits(.isToggle)
    }
}

extension String {
    fileprivate var jsTrimmedTitle: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
