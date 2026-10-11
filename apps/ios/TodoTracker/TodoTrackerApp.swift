import SwiftData
import SwiftUI
import TodoCore

@main
struct TodoTrackerApp: App {
    private let container: ModelContainer
    @State private var model: TodoViewModel

    init() {
        let inMemory = ProcessInfo.processInfo.arguments.contains("-uiTesting")
        let container = SwiftDataTodoStore.makeContainer(inMemory: inMemory)
        self.container = container
        // Accounts are optional: the build settings SUPABASE_URL / SUPABASE_ANON_KEY (Info.plist) turn them on.
        let config = cloudConfig(
            url: Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String,
            anonKey: Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String
        )
        let account = inMemory ? nil : config.map { AccountSession(client: SupabaseClient(config: $0)) }
        _model = State(initialValue: TodoViewModel(store: SwiftDataTodoStore(context: container.mainContext), account: account))
    }

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
                .onOpenURL(perform: model.handleRedirect)
        }
    }
}
