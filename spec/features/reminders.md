# Reminders

Fixtures: [`../fixtures/reminders.json`](../fixtures/reminders.json). Ticket: REED-14.

A todo with a due date can ask to be reminded. The domain decides **when** and **what**; each platform only delivers.

## Rules

- **Offsets**: `at` ("When due"), `1h` ("1 hour before"), `1d` ("1 day before"). The UI shows these labels, in this order, after a "No reminder" choice. The control is disabled until a due date is entered.
- A reminder needs a due date. `createTodo` and `toTodoDraft` drop the reminder when the due date is missing or empty.
- **Time**: a date-only due date is due at `09:00` local time. `at` fires at 09:00 on the due date, `1h` at 08:00 on the due date, `1d` at 09:00 the day before. Offsets are calendar arithmetic in local time, so they keep their wall-clock time across DST. Fixtures write reminder times as local `YYYY-MM-DDTHH:mm:ss` with no `Z`.
- **Plan** (`planReminders`): one reminder per **open** todo that has both a due date and a reminder, in list order. Completed todos get none.
- **Reminder**: `{ key, todoId, title, body, at }`. `title` is `Todo Tracker`. `body` is `Due today: <title>` (`at`), `Due in 1 hour: <title>` (`1h`) or `Due tomorrow: <title>` (`1d`).
- **Key**: `<todoId>:<dueDate>:<offset>`. It changes when the due date or the offset changes, so an edited reminder fires again. It does not depend on the time zone.
- **Due** (`dueReminders`): planned reminders whose time is at or before `now` and whose key is not in the delivered set. A reminder whose time passed while the app was closed is delivered on the next check.
- **Prune** (`pruneDelivered`): keeps only delivered keys that still match a planned reminder (fixtures report the result sorted).

## Delivery per platform

- **Web**: in-tab browser notifications (`Notification`), polled every 30 s while the tab is open, only after the user grants permission. Delivered keys are stored under `todo-tracker:reminders-delivered`.
- **Android**: `POST_NOTIFICATIONS` (API 33+) is requested when the user picks a reminder. Future reminders are scheduled with `AlarmManager` (inexact, no exact-alarm permission); due ones are posted right away. A key counts as handled once it is posted or scheduled, so an alarm that fired while the app was closed is not repeated.
- **iOS**: `UNUserNotificationCenter` local notifications, identifier = key, with the same handled-key rule. Permission is requested when the user picks a reminder.
