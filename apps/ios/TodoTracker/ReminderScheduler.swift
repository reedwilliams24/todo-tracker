import Foundation
import TodoCore
import UserNotifications

@MainActor
protocol ReminderScheduling {
    func requestAuthorization(then: @escaping @MainActor @Sendable () -> Void)
    func sync(_ todos: [Todo])
}

/// Delivers TodoCore's planned reminders as local notifications (spec/features/reminders.md).
/// A key counts as handled once it is scheduled or posted, so it never fires twice.
@MainActor
final class ReminderScheduler: NSObject, ReminderScheduling, UNUserNotificationCenterDelegate {
    static let deliveredKey = "todo-tracker:reminders-delivered"

    private let defaults: UserDefaults
    private let now: () -> Date

    init(defaults: UserDefaults = .standard, now: @escaping () -> Date = Date.init) {
        self.defaults = defaults
        self.now = now
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func requestAuthorization(then: @escaping @MainActor @Sendable () -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { @Sendable _, _ in
            Task { @MainActor in then() }
        }
    }

    func sync(_ todos: [Todo]) {
        let planned = planReminders(todos)
        let live = Set(planned.map(\.key))
        let handled = pruneDelivered(Set(defaults.stringArray(forKey: Self.deliveredKey) ?? []), todos: todos)
        defaults.set(handled.sorted(), forKey: Self.deliveredKey)

        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { @Sendable requests in
            let stale = requests.map(\.identifier).filter { !live.contains($0) }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: stale)
        }
        center.getNotificationSettings { @Sendable settings in
            let status = settings.authorizationStatus
            guard status == .authorized || status == .provisional else { return }
            Task { @MainActor in self.schedule(planned) }
        }
    }

    private func schedule(_ planned: [Reminder]) {
        var handled = Set(defaults.stringArray(forKey: Self.deliveredKey) ?? [])
        for reminder in planned where !handled.contains(reminder.key) {
            UNUserNotificationCenter.current().add(request(for: reminder), withCompletionHandler: nil)
            handled.insert(reminder.key)
        }
        defaults.set(handled.sorted(), forKey: Self.deliveredKey)
    }

    private func request(for reminder: Reminder) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = reminder.title
        content.body = reminder.body
        content.sound = .default
        let trigger: UNNotificationTrigger
        if reminder.at <= now() {
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        } else {
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: reminder.at)
            trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
        }
        return UNNotificationRequest(identifier: reminder.key, content: content, trigger: trigger)
    }

    /// Show reminders as banners while the app is open, like the web tab does.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}
