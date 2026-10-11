import SwiftData
import SwiftUI
import TodoCore
import WidgetKit

/// "Today" home-screen widget (spec/features/today.md). It reads the app's SwiftData store,
/// which both targets open in the shared app group container.
@main
struct TodayWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: todayWidgetKind, provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Open todos due today, overdue first.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct TodayEntry: TimelineEntry {
    let date: Date
    let todos: [Todo]
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), todos: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: Date(), todos: Self.loadTodos()))
    }

    /// The app reloads the timeline after every save; otherwise redraw at local midnight so "today" rolls over.
    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 0),
            matchingPolicy: .nextTime
        ) ?? now.addingTimeInterval(60 * 60)
        completion(Timeline(entries: [TodayEntry(date: now, todos: Self.loadTodos())], policy: .after(midnight)))
    }

    private static func loadTodos() -> [Todo] {
        guard let container = try? ModelContainer(for: StoredTodo.self) else { return [] }
        let context = ModelContext(container)
        let descriptor = FetchDescriptor<StoredTodo>(sortBy: [SortDescriptor(\.position)])
        return ((try? context.fetch(descriptor)) ?? []).compactMap { $0.todo }
    }
}

struct TodayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayEntry

    var body: some View {
        let summary = todaySummary(entry.todos, now: entry.date, limit: family == .systemSmall ? 3 : todayLimit)
        VStack(alignment: .leading, spacing: 4) {
            Text("Today")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.foreground)
            Text(todaySubtitle(summary))
                .font(.system(size: 12))
                .foregroundStyle(summary.overdue > 0 ? Theme.danger : Theme.muted)
                .padding(.bottom, 2)
            ForEach(summary.todos, id: \.id) { todo in
                Text("○ \(todo.title)")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            if let more = todayMoreLabel(summary) {
                Text(more)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(Theme.card, for: .widget)
    }
}
