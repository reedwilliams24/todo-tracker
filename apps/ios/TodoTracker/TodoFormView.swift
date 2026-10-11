import SwiftUI
import TodoCore

struct TodoFormView: View {
    let onAdd: (TodoDraft) -> Void

    @State private var form = TodoFormState.empty

    private var parsed: QuickAddParse { parseQuickAdd(form.title) }
    private var dateOk: Bool { isValidDueDate(form.dueDate) }
    private var canAdd: Bool { isValidTitle(parsed.title) && dateOk }

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            TextField("What needs doing?", text: $form.title, prompt: Text("What needs doing? e.g. tomorrow !p1 #tag").foregroundStyle(Theme.muted))
                .font(.system(size: 16))
                .foregroundStyle(Theme.foreground)
                .padding(8)
                .submitLabel(.done)
                .onSubmit(submit)
                .accessibilityLabel("Todo title")
                .accessibilityIdentifier(TestID.formTitle)
            HStack(spacing: 8) {
                priorityPicker
                TextField("YYYY-MM-DD", text: $form.dueDate, prompt: Text("YYYY-MM-DD").foregroundStyle(Theme.muted))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground)
                    .keyboardType(.numbersAndPunctuation)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.md)
                            .stroke(dateOk ? Theme.border : Theme.danger, lineWidth: 1)
                    )
                    .accessibilityLabel("Due date")
                    .accessibilityIdentifier(TestID.formDueDate)
            }
            recurrencePicker
                .frame(maxWidth: .infinity, alignment: .leading)
            let preview = parsed
            if hasQuickAddMeta(preview) {
                QuickAddPreview(parse: preview)
            }
            Button(action: submit) {
                Text("Add")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.card)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Theme.foreground, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            }
            .buttonStyle(UndimmedButtonStyle())
            .disabled(!canAdd)
            .opacity(canAdd ? 1 : 0.4)
            .accessibilityLabel("Add todo")
            .accessibilityIdentifier(TestID.formSubmit)
        }
        .padding(12)
        .cardStyle()
    }

    private var priorityPicker: some View {
        HStack(spacing: 0) {
            ForEach([TodoPriority.low, .medium, .high], id: \.self) { option in
                let selected = option == form.priority
                Button { form.priority = option } label: {
                    Text(option.rawValue.capitalized)
                        .font(.system(size: 14))
                        .foregroundStyle(selected ? Theme.card : Theme.foreground)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(selected ? Theme.foreground : .clear)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier(TestID.formPriorityOption(option))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.border, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Priority")
        .accessibilityIdentifier(TestID.formPriority)
    }

    private var recurrencePicker: some View {
        HStack(spacing: 0) {
            ForEach([nil] + Recurrence.allCases.map(Optional.some), id: \.self) { (option: Recurrence?) in
                let selected = (option?.rawValue ?? "") == form.recurrence
                Button { form.recurrence = option?.rawValue ?? "" } label: {
                    Text(option?.label ?? "No repeat")
                        .font(.system(size: 14))
                        .foregroundStyle(selected ? Theme.card : Theme.foreground)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(selected ? Theme.foreground : .clear)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier(TestID.formRecurrenceOption(option))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.border, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Repeat")
        .accessibilityIdentifier(TestID.formRecurrence)
    }

    private func submit() {
        guard canAdd else { return }
        var draft = quickAddToDraft(parsed, fallbackPriority: form.priority, fallbackDueDate: form.dueDate)
        draft.recurrence = Recurrence(rawValue: form.recurrence)
        onAdd(draft)
        form = .empty
    }
}

private struct QuickAddPreview: View {
    let parse: QuickAddParse

    private var meta: String {
        var parts: [String] = []
        if let dueDate = parse.dueDate { parts.append("Due \(dueDate)") }
        if let priority = parse.priority { parts.append("\(priority.rawValue.capitalized) priority") }
        parts += parse.tags.map { "#\($0)" }
        return parts.joined(separator: "  ·  ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Text("Will add:")
                    .foregroundStyle(Theme.muted)
                Text(parse.title.isEmpty ? "…" : parse.title)
                    .fontWeight(.medium)
                    .foregroundStyle(Theme.foreground)
                    .accessibilityIdentifier(TestID.quickAddPreviewTitle)
            }
            if !meta.isEmpty {
                Text(meta).foregroundStyle(Theme.muted)
            }
        }
        .font(.system(size: 12))
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(TestID.quickAddPreview)
    }
}

/// Keeps the label colors when disabled; the RN app dims the whole button with opacity instead.
private struct UndimmedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.8 : 1)
    }
}
