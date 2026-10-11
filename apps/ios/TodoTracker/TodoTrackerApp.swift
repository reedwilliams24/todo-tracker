import SwiftData
import SwiftUI

@main
struct TodoTrackerApp: App {
    private let container: ModelContainer
    @State private var model: TodoViewModel

    init() {
        let inMemory = ProcessInfo.processInfo.arguments.contains("-uiTesting")
        let container = SwiftDataTodoStore.makeContainer(inMemory: inMemory)
        self.container = container
        let store = SwiftDataTodoStore(context: container.mainContext)
        let reminders: ReminderScheduling? = inMemory ? nil : ReminderScheduler()
        let defaults = inMemory ? Self.uiTestingDefaults() : .standard
        _model = State(initialValue: TodoViewModel(store: store, reminders: reminders, defaults: defaults))
    }

    /// UI tests start from a clean sort preference, like the in-memory store.
    private static func uiTestingDefaults() -> UserDefaults {
        let suite = "todo-tracker-ui-testing"
        let defaults = UserDefaults(suiteName: suite) ?? .standard
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
        }
    }
}
