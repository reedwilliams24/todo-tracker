import SwiftUI
import TodoCore

struct ContentView: View {
    @Bindable var model: TodoViewModel
    var auth: AuthViewModel?
    @AppStorage(themeStorageKey) private var storedTheme = defaultTheme.rawValue
    @State private var rowEditing = false

    private var theme: ThemePreference { parseThemePreference(storedTheme) }

    var body: some View {
        TabView(selection: $model.tab) {
            NavigationStack { todayScreen }
                .tabItem { DaybookTabLabel(tab: .today) }
                .tag(DaybookTab.today)
            NavigationStack { upcomingScreen }
                .tabItem { DaybookTabLabel(tab: .upcoming) }
                .tag(DaybookTab.upcoming)
            NavigationStack { statsScreen }
                .tabItem { DaybookTabLabel(tab: .stats) }
                .tag(DaybookTab.stats)
        }
        .tint(Theme.accent)
        .authPresentation(auth)
        .onChange(of: editable) { _, editable in
            if !editable { model.leaveSelectMode() }
        }
        .preferredColorScheme(theme.colorScheme)
    }

    private func screen<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                content()
            }
            .padding(16)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.immediately)
        .contentShape(Rectangle())
        // Like RN's keyboardShouldPersistTaps="handled": tapping empty space blurs the focused field (committing a rename).
        .onTapGesture {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
        .background(Theme.background)
        .overlay(alignment: .bottom) { toast }
        .animation(.easeOut(duration: 0.15), value: model.undoLabel)
        .navigationTitle(title)
    }

    private var todayScreen: some View {
        screen(t("app.title")) {
            banners
            todayHeader
            ListControlsView(model: model, editable: editable)
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
        .onPreferenceChange(RowEditingKey.self) { editing in
            Task { @MainActor in rowEditing = editing }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ThemePicker() }
        }
        // Capture bar: its own inset above the tab bar (and keyboard), outside the list rows.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            // Collapsed (not removed, so a draft survives) while a row is renamed, leaving the row room above the keyboard.
            captureBar
                .frame(maxHeight: rowEditing ? 0 : nil)
                .clipped()
                .accessibilityHidden(rowEditing)
        }
    }

    private var captureBar: some View {
        // Content-sized scroll view: a drag on the (expanded) bar dismisses the keyboard, like the list.
        // Without it Maestro's hideKeyboard swipe lands on the bar and fails.
        ScrollView {
            TodoFormView(onAdd: model.add, onPickReminder: model.requestReminderPermission)
                .disabled(!editable)
                .opacity(editable ? 1 : 0.5)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .frame(maxWidth: 640)
                .frame(maxWidth: .infinity)
        }
        .fixedSize(horizontal: false, vertical: true)
        .scrollDismissesKeyboard(.immediately)
        .background(Theme.background)
    }

    private var todayHeader: some View {
        let progress = model.progress
        return TimelineView(.everyMinute) { context in
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(t(greetingKey(context.date)))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.muted)
                    Text(context.date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
                        .font(.system(size: 28, weight: .bold))
                        .tracking(-0.5)
                        .foregroundStyle(Theme.foreground)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .accessibilityAddTraits(.isHeader)
                }
                Spacer(minLength: 0)
                Text(t("daybook.left", ["count": progress.total - progress.done]))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.trailing)
                ProgressRing(done: progress.done, total: progress.total)
            }
        }
    }

    private func greetingKey(_ date: Date) -> String {
        let hour = Calendar.current.component(.hour, from: date)
        return hour < 12
            ? "daybook.greeting.morning" : hour < 18 ? "daybook.greeting.afternoon" : "daybook.greeting.evening"
    }

    private var upcomingScreen: some View {
        screen(t("upcoming.title")) {
            Text(t("upcoming.subtitle"))
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
            let days = model.upcoming
            if days.isEmpty {
                Text(t("upcoming.empty"))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .accessibilityIdentifier(TestID.upcomingEmpty)
            } else {
                VStack(alignment: .leading, spacing: 20) {
                    ForEach(days, id: \.date) { day in
                        VStack(alignment: .leading, spacing: 8) {
                            sectionTitle(dayLabel(day.date), count: day.todos.count)
                                .accessibilityIdentifier(TestID.upcomingDay(day.date))
                            ForEach(day.todos) { todo in row(todo, reorderable: false) }
                        }
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier(TestID.upcomingList)
            }
        }
    }

    private func dayLabel(_ date: String) -> String {
        let today = model.today
        guard let day = Self.dayFormatter.date(from: date), let start = Self.dayFormatter.date(from: today) else {
            return date
        }
        switch Calendar.current.dateComponents([.day], from: start, to: day).day ?? 0 {
        case 0: return t("upcoming.today")
        case 1: return t("upcoming.tomorrow")
        default: return day.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        }
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private var statsScreen: some View {
        screen(t("stats.title")) {
            StatsPanelView(stats: model.stats)
        }
    }

    private func sectionTitle(_ title: String, count: Int) -> some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.foreground)
            Text("\(count)")
                .font(.system(size: 13, weight: .medium).monospacedDigit())
                .foregroundStyle(Theme.muted)
        }
        .padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private var list: some View {
        if model.visibleTodos.isEmpty {
            Text(model.emptyText)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .accessibilityIdentifier(TestID.empty)
        } else {
            let sections = model.sections
            LazyVStack(alignment: .leading, spacing: 8) {
                ForEach(
                    [("slipped", sections.slipped), ("today", sections.today), ("later", sections.later)],
                    id: \.0
                ) { name, todos in
                    if !todos.isEmpty {
                        sectionTitle(t("daybook.section.\(name)"), count: todos.count)
                            .padding(.top, 8)
                            .accessibilityIdentifier(TestID.daybookSection(name))
                        ForEach(todos) { todo in row(todo, reorderable: true) }
                    }
                }
                if !sections.done.isEmpty {
                    HStack {
                        sectionTitle(t("daybook.section.done"), count: sections.done.count)
                            .accessibilityIdentifier(TestID.daybookSection("done"))
                        Spacer(minLength: 0)
                        if model.filter != .completed {
                            Button(t(model.showDone ? "daybook.done.hide" : "daybook.done.show")) {
                                model.doneOpen.toggle()
                            }
                            .buttonStyle(.plain)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.accent)
                            .accessibilityIdentifier(TestID.daybookDoneToggle)
                        }
                    }
                    .padding(.top, 8)
                    if model.showDone {
                        ForEach(sections.done) { todo in row(todo, reorderable: true) }
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(TestID.list)
        }
    }

    @ViewBuilder
    private func row(_ todo: Todo, reorderable: Bool) -> some View {
        let view = TodoRowView(
            todo: todo,
            today: model.today,
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
        if reorderable {
            // Long-press a row and drop it on another to move it there.
            view
                .draggable(todo.id)
                .dropDestination(for: String.self) { ids, _ in
                    guard editable, let id = ids.first, id != todo.id else { return false }
                    model.reorder(id, onto: todo.id)
                    return true
                }
        } else {
            view
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
            .padding(.bottom, 16)
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
        // Own row: the navigation bar has no room for an email next to the title and theme picker.
        if let auth, auth.state.status != .signedOut {
            AccountMenu(auth: auth).frame(maxWidth: .infinity, alignment: .trailing)
        }
        if let auth { AuthBanner(auth: auth) }
        ConnectionBannerView(status: status)
    }
}
