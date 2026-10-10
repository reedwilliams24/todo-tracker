# Todo

Fixtures: [`../fixtures/todo.json`](../fixtures/todo.json). Shape: [`../schema/todo.schema.json`](../schema/todo.schema.json).

## Rules

- **Title**: trimmed. Valid when 1–200 characters after trimming. Edits with an invalid, blank or unchanged title are ignored (the todo, including `updatedAt`, is left untouched).
- **Notes**: optional. Trimmed; blank notes are dropped, not stored as `""`.
- **Priority**: `low | medium | high`, default `medium`.
- **Due date**: optional calendar date `YYYY-MM-DD` with no time zone. Must be a real date (no `2026-02-29`). Empty input means "no due date".
- **Timestamps**: `createdAt` and `updatedAt` are UTC ISO-8601 with milliseconds (`2026-01-05T09:00:00.000Z`). Create sets both to now; toggle and rename set `updatedAt` to now.
- **Ids**: opaque, unique strings. Fixtures write freshly created ids as `new-1`, `new-2`, … (see [README](../README.md#normalization)).
- **Toggle** flips `completed` and bumps `updatedAt`.
- **Form → draft**: the add form holds `{title, priority, dueDate}` strings; `toTodoDraft` trims the title and omits an empty due date.
