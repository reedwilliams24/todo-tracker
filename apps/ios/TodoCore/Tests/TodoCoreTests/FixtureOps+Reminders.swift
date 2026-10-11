import Foundation
import TodoCore

/// `reminders` ops; mirrors packages/spec/src/features/reminders.ts.
extension FixtureOps {
    static var remindersOps: [String: Op] {
        [
            "remindersConstants": { _ in
                return RemindersConstants()
            },
            "reminderAt": { g in
                return reminderAt(try g.decode("todo")).map(localTime)
            },
            "describeReminder": { g in
                return describeReminder(try g.decode("todo"))
            },
            "planReminders": { g in
                return planReminders(try g.decode("todos")).map(ReminderResult.init)
            },
            "dueReminders": { g in
                return dueReminders(try g.decode("todos"), delivered: try g.decode("delivered"), now: try g.date("now"))
                    .map(ReminderResult.init)
            },
            "pruneDelivered": { g in
                return pruneDelivered(try g.decode("delivered"), todos: try g.decode("todos")).sorted()
            },
        ]
    }

    private struct RemindersConstants: Encodable {
        let reminderOffsets = TodoCore.reminderOffsets
        let reminderLabels = Dictionary(uniqueKeysWithValues: ReminderOffset.allCases.map { ($0.rawValue, $0.label) })
        let dueHour = TodoCore.dueHour
    }

    /// Local wall-clock `YYYY-MM-DDTHH:mm:ss`, the format reminder fixtures use.
    private static func localTime(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return String(format: "%04d-%02d-%02dT%02d:%02d:%02d", c.year!, c.month!, c.day!, c.hour!, c.minute!, c.second!)
    }

    private struct ReminderResult: Encodable {
        let key: String
        let todoId: String
        let title: String
        let body: String
        let at: String

        init(_ reminder: Reminder) {
            key = reminder.key
            todoId = reminder.todoId
            title = reminder.title
            body = reminder.body
            at = FixtureOps.localTime(reminder.at)
        }
    }
}
