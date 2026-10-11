import SwiftUI
import TodoCore

struct TodoFormView: View {
    let existingTags: [String]
    let onAdd: (TodoDraft) -> Void

    @State private var form = TodoFormState.empty

    private var dateOk: Bool { isValidDueDate(form.dueDate) }
    private var canAdd: Bool { isValidTitle(form.title) && dateOk }
    private var suggestions: [String] { tagSuggestions(form.tags, existing: existingTags) }

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            TextField("What needs doing?", text: $form.title, prompt: Text("What needs doing?").foregroundStyle(Theme.muted))
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
            TextField("Tags, comma-separated", text: $form.tags, prompt: Text("Tags, comma-separated").foregroundStyle(Theme.muted))
                .font(.system(size: 14))
                .foregroundStyle(Theme.foreground)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.border, lineWidth: 1))
                .submitLabel(.done)
                .onSubmit(submit)
                .accessibilityLabel("Tags")
                .accessibilityIdentifier(TestID.formTags)
            if !suggestions.isEmpty {
                HStack(spacing: 4) {
                    ForEach(suggestions, id: \.self) { tag in
                        Button { form.tags = completeTag(form.tags, tag) } label: {
                            Text("#\(tag)")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.foreground.opacity(0.7))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Add tag \(tag)")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
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

    private func submit() {
        guard canAdd else { return }
        onAdd(toTodoDraft(form))
        form = .empty
    }
}

/// Existing tags that complete the piece after the last comma, skipping ones already entered.
private func tagSuggestions(_ text: String, existing: [String]) -> [String] {
    let comma = text.lastIndex(of: ",")
    let head = comma.map { String(text[..<$0]) } ?? ""
    let piece = comma.map { String(text[text.index(after: $0)...]) } ?? text
    guard let current = parseTags(piece).first else { return [] }
    let entered = parseTags(head)
    return Array(existing.filter { $0.hasPrefix(current) && $0 != current && !entered.contains($0) }.prefix(5))
}

private func completeTag(_ text: String, _ tag: String) -> String {
    let head = text.lastIndex(of: ",").map { String(text[...$0]) + " " } ?? ""
    return head + tag + ", "
}

/// Keeps the label colors when disabled; the RN app dims the whole button with opacity instead.
private struct UndimmedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.8 : 1)
    }
}
