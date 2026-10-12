import SwiftUI
import TodoCore

/// Filter, select/clear actions, sort and the bulk-selection bar above the Today list.
struct ListControlsView: View {
    @Bindable var model: TodoViewModel
    var editable = true

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            toolbar
            sortControl
            if model.selecting { bulkBar }
        }
    }

    private var toolbar: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) {
                filterButtons
                Spacer(minLength: 0)
                toolbarActions
            }
            VStack(alignment: .leading, spacing: 8) {
                filterButtons
                HStack(spacing: 16) {
                    Spacer(minLength: 0)
                    toolbarActions
                }
            }
        }
    }

    private var filterButtons: some View {
        HStack(spacing: 4) {
            ForEach(TodoFilter.allCases, id: \.self) { option in
                let selected = model.filter == option
                Button {
                    model.filter = option
                } label: {
                    Text(t("filter.\(option.rawValue)"))
                        .font(.system(size: 14))
                        .lineLimit(1)
                        .fixedSize()
                        .foregroundStyle(selected ? Theme.accentInk : Theme.muted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(selected ? Theme.accent : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier(TestID.filter(option))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(t("filter.label"))
    }

    private var toolbarActions: some View {
        HStack(spacing: 16) {
            if !model.state.todos.isEmpty {
                Button(t(model.selecting ? "select.done" : "select.enter"), action: model.toggleSelectMode)
                    .buttonStyle(.plain)
                    .font(.system(size: 14))
                    .lineLimit(1)
                    .fixedSize()
                    .foregroundStyle(Theme.muted)
                    .disabled(!editable)
                    .accessibilityIdentifier(TestID.selectMode)
            }
            if model.completedCount > 0, !model.selecting {
                Button(t("list.clearCompleted", ["count": model.completedCount]), action: model.clearCompleted)
                    .buttonStyle(.plain)
                    .font(.system(size: 14))
                    .lineLimit(1)
                    .fixedSize()
                    .foregroundStyle(Theme.muted)
                    .disabled(!editable)
                    .accessibilityIdentifier(TestID.clearCompleted)
            }
        }
    }

    private var sortControl: some View {
        HStack(spacing: 4) {
            Text(t("sort.label"))
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .padding(.trailing, 4)
            ForEach(TodoSort.allCases, id: \.self) { option in
                let selected = model.sort == option
                Button {
                    model.sort = option
                } label: {
                    Text(t("sort.\(option.rawValue)"))
                        .font(.system(size: 14))
                        .foregroundStyle(selected ? Theme.accentInk : Theme.muted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(selected ? Theme.accent : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier(TestID.sortOption(option))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(t("sort.ariaLabel"))
        .accessibilityIdentifier(TestID.sort)
    }

    private var bulkBar: some View {
        let count = model.selected.count
        return Group {
            if model.confirmingDelete {
                HStack(spacing: 12) {
                    Text(t("bulk.confirm", ["count": count]))
                        .font(.system(size: 14, weight: .medium))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .foregroundStyle(Theme.foreground)
                    Spacer(minLength: 0)
                    actionButton(t("bulk.cancel"), id: TestID.bulkDeleteCancel) { model.confirmingDelete = false }
                    actionButton(
                        t("bulk.delete"), id: TestID.bulkDeleteConfirm, danger: true, action: model.deleteSelected)
                }
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) {
                        bulkSelectionControls(count)
                        Spacer(minLength: 0)
                        bulkActionButtons(count)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        bulkSelectionControls(count)
                        HStack(spacing: 12) {
                            Spacer(minLength: 0)
                            bulkActionButtons(count)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .cardStyle()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(t("bulk.label"))
        .accessibilityIdentifier(TestID.bulkBar)
    }

    private func bulkSelectionControls(_ count: Int) -> some View {
        HStack(spacing: 12) {
            Text(t("select.count", ["count": count]))
                .font(.system(size: 14))
                .lineLimit(1)
                .fixedSize()
                .foregroundStyle(Theme.muted)
                .accessibilityIdentifier(TestID.selectedCount)
            Button(t(model.allVisibleSelected ? "select.none" : "select.all"), action: model.toggleSelectAll)
                .buttonStyle(.plain)
                .font(.system(size: 14))
                .lineLimit(1)
                .fixedSize()
                .foregroundStyle(Theme.foreground)
                .accessibilityIdentifier(TestID.selectAll)
        }
    }

    private func bulkActionButtons(_ count: Int) -> some View {
        HStack(spacing: 12) {
            actionButton(
                t("bulk.toggle"), id: TestID.bulkToggle, enabled: count > 0, action: model.toggleSelectedComplete)
            actionButton(t("bulk.delete"), id: TestID.bulkDelete, enabled: count > 0, danger: true) {
                model.confirmingDelete = true
            }
        }
    }

    private func actionButton(
        _ title: String, id: String, enabled: Bool = true, danger: Bool = false, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .lineLimit(1)
                .fixedSize()
                .foregroundStyle(danger ? Theme.card : Theme.foreground)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(danger ? Theme.danger : Theme.card, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.md).strokeBorder(danger ? Theme.danger : Theme.border))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityIdentifier(id)
    }
}
