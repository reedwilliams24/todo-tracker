import SwiftUI
import TodoCore

/// Collapsible stats section: completed total, streaks and a per-day bar chart (spec/features/stats.md).
struct StatsPanelView: View {
    let stats: TodoStats
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                open.toggle()
            } label: {
                HStack {
                    Text(t("stats.title"))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.foreground)
                    Spacer()
                    Text(t(open ? "stats.hide" : "stats.show"))
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(t(open ? "stats.hidesHint" : "stats.showsHint"))
            .accessibilityIdentifier(TestID.statsToggle)

            if open {
                HStack(alignment: .top) {
                    value(t("stats.completed"), "\(stats.totalCompleted)", id: TestID.statsTotal)
                    value(
                        t("stats.currentStreak"), t("stats.days", ["count": stats.currentStreak]),
                        id: TestID.statsCurrent)
                    value(
                        t("stats.longestStreak"), t("stats.days", ["count": stats.longestStreak]),
                        id: TestID.statsLongest)
                }
                chart
            }
        }
        .padding(16)
        .cardStyle()
    }

    private func value(_ label: String, _ text: String, id: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Theme.muted)
            Text(text)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.foreground)
                .accessibilityIdentifier(id)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var chart: some View {
        let peak = max(1, stats.perDay.map(\.count).max() ?? 0)
        return HStack(alignment: .bottom, spacing: 2) {
            ForEach(stats.perDay, id: \.date) { day in
                RoundedRectangle(cornerRadius: 2)
                    .fill(day.count == 0 ? Theme.border : Theme.foreground)
                    .frame(maxWidth: .infinity)
                    .frame(height: day.count == 0 ? 3 : 64 * CGFloat(day.count) / CGFloat(peak))
                    .accessibilityLabel(t("stats.day", ["date": day.date, "count": day.count]))
            }
        }
        .frame(height: 64, alignment: .bottom)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(t("stats.chart", ["days": statsDays]))
        .accessibilityIdentifier(TestID.statsChart)
    }
}
