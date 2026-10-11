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
        _model = State(initialValue: TodoViewModel(store: store, reminders: reminders))
    }

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
        }
    }
}
