import SwiftUI
import TodoCore

/// System tab item for a Daybook destination (spec/features/daybook.md#shell).
struct DaybookTabLabel: View {
    let tab: DaybookTab

    var body: some View {
        Label(t("nav.\(tab.rawValue)"), systemImage: icon)
            .accessibilityIdentifier(tab == .stats ? TestID.statsToggle : TestID.tab(tab.rawValue))
    }

    private var icon: String {
        switch tab {
        case .today: "sun.max"
        case .upcoming: "calendar"
        case .stats: "chart.bar"
        }
    }
}

/// True while any row's inline title editor is open.
struct RowEditingKey: PreferenceKey {
    static let defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) { value = value || nextValue() }
}

/// Light / Dark / System segmented control (spec/features/theme.md).
struct ThemePicker: View {
    @AppStorage(themeStorageKey) private var storedTheme = defaultTheme.rawValue

    private var theme: ThemePreference { parseThemePreference(storedTheme) }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(themePreferences, id: \.self) { option in
                let selected = theme == option
                Button {
                    storedTheme = option.rawValue
                } label: {
                    Text(t("theme.\(option.rawValue)"))
                        .font(.system(size: 12))
                        .foregroundStyle(selected ? Theme.accent : Theme.muted)
                        .fontWeight(selected ? .semibold : .regular)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(selected ? Theme.soft : .clear)
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
}

/// Daybook progress ring: today's completions out of today's load.
struct ProgressRing: View {
    let done: Int
    let total: Int

    var body: some View {
        ZStack {
            Circle().stroke(Theme.border, lineWidth: 6)
            Circle()
                .trim(from: 0, to: total > 0 ? CGFloat(done) / CGFloat(total) : 0)
                .stroke(Theme.accent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.3), value: done)
            Text("\(done)/\(total)")
                .font(.system(size: 12, weight: .bold).monospacedDigit())
                .foregroundStyle(Theme.foreground)
                .accessibilityIdentifier(TestID.daybookProgress)
        }
        .frame(width: 50, height: 50)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(t("daybook.progress", ["done": done, "total": total]))
    }
}
