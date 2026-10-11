# Recurrence

Fixtures: [`../fixtures/recurrence.json`](../fixtures/recurrence.json). Shape: `recurrence` in [`../schema/todo.schema.json`](../schema/todo.schema.json).

## Rules

- **Rule**: optional `recurrence` on a todo, one of `daily | weekly | monthly`. Absent means the todo happens once. The add form holds it as a string (`""` = no repeat); `toTodoDraft` omits an empty value.
- **Next due date** (`nextOccurrence`) is computed on calendar days, never on clock time, so DST changes can't shift it:
  - `daily`: +1 day; `weekly`: +7 days (both roll over months and years).
  - `monthly`: same day next month, clamped to that month's last day (`2026-01-31` → `2026-02-28`, `2028-01-31` → `2028-02-29`). It is always computed from the completed todo's due date, so the day can drift down after a short month (Jan 31 → Feb 28 → Mar 28).
- **Completing** a recurring todo (`toggleInList`, reducer `toggle`) keeps the completed todo and inserts a new active todo **right after it** in storage order (`scheduleNext`):
  - same `title`, `notes`, `priority` and `recurrence`; new `id`; `createdAt` = `updatedAt` = now;
  - `dueDate` = `nextOccurrence(dueDate)`. A recurring todo with no due date uses today's date, the UTC calendar date of `now`, as the base.
- **Reopening** a completed recurring todo does not schedule anything and does not remove the occurrence created earlier. Completing it again schedules another one.
- **Undo** of the completion restores the whole list snapshot, so the scheduled occurrence disappears too (see [undo](undo.md)).
- **Display**: rows show the rule as `↻ Daily` / `↻ Weekly` / `↻ Monthly`.
