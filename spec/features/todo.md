# Todo

Fixtures: [`../fixtures/todo.json`](../fixtures/todo.json). Shape: [`../schema/todo.schema.json`](../schema/todo.schema.json).

## Rules

- **Title**: trimmed. Valid when 1–200 characters after trimming. Edits with an invalid, blank or unchanged title are ignored (the todo, including `updatedAt`, is left untouched).
- **Notes**: optional. Trimmed; blank notes are dropped, not stored as `""`.
- **Priority**: `low | medium | high`, default `medium`.
- **Due date**: optional calendar date `YYYY-MM-DD` with no time zone. Must be a real date (no `2026-02-29`). Empty input means "no due date".
- **Reminder**: optional offset `at | 1h | 1d`, only kept when the todo has a due date (see [reminders](reminders.md)).
- **Timestamps**: `createdAt` and `updatedAt` are UTC ISO-8601 with milliseconds (`2026-01-05T09:00:00.000Z`). Create sets both to now; toggle and rename set `updatedAt` to now.
- **Ids**: opaque, unique strings. Fixtures write freshly created ids as `new-1`, `new-2`, … (see [README](../README.md#normalization)).
- **Toggle** flips `completed` and bumps `updatedAt`. Completing sets `completedAt` to now; reopening removes it.
- **Overdue** (`isOverdue`): an incomplete todo whose due date is before today's local calendar date (`toDateKey(now)`, `YYYY-MM-DD` in the device's time zone). A todo due today is not overdue; completed and undated todos never are. Overdue todos show an "Overdue" marker next to the due date.
- **Form → draft**: the add form holds `{title, priority, dueDate, reminder}` strings; `toTodoDraft` trims the title, omits an empty due date, and omits the reminder when it is empty or there is no due date.
