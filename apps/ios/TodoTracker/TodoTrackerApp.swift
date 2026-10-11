import SwiftData
import SwiftUI

@main
struct TodoTrackerApp: App {
    private let container: ModelContainer
    // A ModelContext doesn't keep its container alive; fetching after the container is freed traps.
    private let accountContainer: ModelContainer
    private let guestStore: TodoStore
    private let accountStore: TodoStore
    @State private var model: TodoViewModel
    @State private var auth: AuthViewModel?
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let inMemory = ProcessInfo.processInfo.arguments.contains("-uiTesting")
        let container = SwiftDataTodoStore.makeContainer(inMemory: inMemory)
        self.container = container
        let store = SwiftDataTodoStore(context: container.mainContext)
        let accountContainer = SwiftDataTodoStore.makeContainer(inMemory: inMemory, name: "account")
        self.accountContainer = accountContainer
        let accountStore = SwiftDataTodoStore(context: accountContainer.mainContext)
        guestStore = store
        self.accountStore = accountStore
        let reminders: ReminderScheduling? = inMemory ? nil : ReminderScheduler()
        let defaults = inMemory ? Self.uiTestingDefaults() : .standard
        // UI tests (and builds without Supabase config) stay guest-only.
        let auth =
            inMemory
            ? nil
            : SupabaseConfig.client().map {
                AuthViewModel(client: $0, guest: store, account: accountStore, defaults: defaults)
            }
        _auth = State(initialValue: auth)
        let initial: TodoStore = auth?.scope == .account ? accountStore : store
        _model = State(initialValue: TodoViewModel(store: initial, reminders: reminders, defaults: defaults))
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
            ContentView(model: model, auth: auth)
                .onChange(of: auth?.scope) { _, scope in
                    model.useStore(scope == .account ? accountStore : guestStore)
                    updateSync()
                }
                .onChange(of: auth?.session?.userId) { updateSync() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.pull() }
                }
                .task { updateSync() }
        }
    }

    /// The account list syncs while signed in; the guest list never does.
    private func updateSync() {
        let server = auth?.scope == .account ? auth?.syncServer : nil
        model.useSync(server, userId: auth?.session?.userId)
    }
}
