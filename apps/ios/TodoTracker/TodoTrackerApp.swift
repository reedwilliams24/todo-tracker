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
        _model = State(initialValue: TodoViewModel(store: SwiftDataTodoStore(context: container.mainContext)))
    }

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
        }
    }
}
