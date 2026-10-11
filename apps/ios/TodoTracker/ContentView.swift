import SwiftUI
import TodoCore

struct ContentView: View {
    @Bindable var model: TodoViewModel
    var auth: AuthViewModel?
    @AppStorage(themeStorageKey) private var storedTheme = defaultTheme.rawValue

    private var theme: ThemePreference { parseThemePreference(storedTheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(t("app.title"))
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(Theme.foreground)
                            .accessibilityAddTraits(.isHeader)
                        Text(t("app.tagline.mobile"))
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                    }
                    Spacer(minLength: 0)
                    themePicker
                }
                banners
                TodoFormView(onAdd: model.add, onPickReminder: model.requestReminderPermission)
                    .disabled(!editable)
                    .opacity(editable ? 1 : 0.5)
                toolbar
                sortControl
                if model.selecting { bulkBar }
                list
                Text(model.remainingText)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                    .accessibilityIdentifier(TestID.remaining)
                    // Like aria-live="polite" on web: VoiceOver reads the new count after toggles and deletes.
                    .onChange(of: model.remainingText) { _, text in
                        UIAccessibility.post(notification: .announcement, argument: text)
                    }
                StatsPanelView(stats: model.stats)
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
        .authPresentation(auth)
        .onChange(of: editable) { _, editable in
            if !editable { model.leaveSelectMode() }
        }
        .preferredColorScheme(theme.colorScheme)
    }

    private var themePicker: some View {
        HStack(spacing: 0) {
            ForEach(themePreferences, id: \.self) { option in
                let selected = theme == option
                Button {
                    storedTheme = option.rawValue
                } label: {
                    Text(t("theme.\(option.rawValue)"))
                        .font(.system(size: 12))
                        .foregroundStyle(selected ? Theme.card : Theme.foreground.opacity(0.7))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(selected ? Theme.foreground : .clear)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier(TestID.themeOption(option))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.border, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(t("theme.label"))
        .accessibilityIdentifier(TestID.themeToggle)
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
                    .foregroundStyle(Theme.foreground.opacity(0.7))
                    .disabled(!editable)
                    .accessibilityIdentifier(TestID.selectMode)
            }
            if model.completedCount > 0, !model.selecting {
                Button(t("list.clearCompleted", ["count": model.completedCount]), action: model.clearCompleted)
                    .buttonStyle(.plain)
                    .font(.system(size: 14))
                    .lineLimit(1)
                    .fixedSize()
                    .foregroundStyle(Theme.foreground.opacity(0.7))
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
                        onAddSubtask: { model.addSubtask(todo.id, title: $0) },
                        onToggleSubtask: { model.toggleSubtask(todo.id, subtaskId: $0) },
                        onRemoveSubtask: { model.removeSubtask(todo.id, subtaskId: $0) },
                        selection: model.selecting
                            ? TodoRowView.Selection(
                                selected: model.selectedIds.contains(todo.id),
                                onSelect: { model.toggleSelected(todo.id) })
                            : nil,
                        editable: editable
                    )
                    // Long-press a row and drop it on another to move it there.
                    .draggable(todo.id)
                    .dropDestination(for: String.self) { ids, _ in
                        guard editable, let id = ids.first, id != todo.id else { return false }
                        model.reorder(id, onto: todo.id)
                        return true
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(TestID.list)
        }
    }

    private var toast: some View {
        VStack(spacing: 8) {
            if model.pushFailed {
                Text(t("sync.pushFailed"))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.card)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Theme.danger, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                    .padding(.horizontal, 16)
                    .accessibilityIdentifier(TestID.syncError)
                    .onAppear { UIAccessibility.post(notification: .announcement, argument: t("sync.pushFailed")) }
            }
            undoToast
        }
    }

    @ViewBuilder
    private var undoToast: some View {
        if let label = model.undoLabel {
            HStack(spacing: 16) {
                Text(label)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.card)
                    .accessibilityIdentifier(TestID.undoLabel)
                Button(action: model.undo) {
                    Text(t("undo.action"))
                        .font(.system(size: 14, weight: .semibold))
                        .underline()
                        .foregroundStyle(Theme.card)
                        .padding(8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(-8)
                .disabled(!editable)
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

extension ContentView {
    /// Read-only state of the shown list (spec/features/realtime.md#connection-status).
    private var status: ConnectionStatus {
        let expired = auth?.state.status == .expired
        return connectionStatus(
            account: model.connection != nil || expired, expired: expired, online: model.online,
            connection: model.connection)
    }

    private var editable: Bool { canEdit(status) }

    @ViewBuilder
    private var banners: some View {
        // Own row: the header has no room for an email next to the title and theme picker.
        if let auth, auth.state.status != .signedOut {
            AccountMenu(auth: auth).frame(maxWidth: .infinity, alignment: .trailing)
        }
        if let auth { AuthBanner(auth: auth) }
        ConnectionBannerView(status: status)
    }
}
