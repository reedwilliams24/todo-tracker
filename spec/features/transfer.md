# Import / export

Fixtures: [`../fixtures/transfer.json`](../fixtures/transfer.json). Reference implementation: `apps/web/src/domain/transfer.ts`.

## Export

- JSON export is the envelope `{ "version": 1, "exportedAt": <now, UTC ISO-8601 with ms>, "todos": [...] }`. Todos keep list order and every stored field; absent optional fields are omitted.
- CSV export has the header `id,title,completed,priority,dueDate,notes,createdAt,updatedAt` and one row per todo, joined with `\n`, no trailing newline. Absent fields are empty cells; booleans are `true`/`false`. A cell containing `"`, `,`, `\n` or `\r` is wrapped in quotes with `"` doubled.
- File name: `todos-YYYY-MM-DD.json` / `.csv`, using the UTC date of `now`.

## Import (JSON only)

- The file is either the export envelope (only its `todos` field is read) or a bare array of todos.
- Unparseable input yields the single error `File is not valid JSON`. Valid JSON that is neither an array nor an object with an array `todos` yields `Expected a list of todos`.
- Items are checked in order; the first failing rule is the item's error. `N` is the 1-based position, `ID` the item's id:
  - not an object → `Item N: not an object`
  - `id` not a non-empty string → `Item N: missing id`
  - `title` not a string that is valid per [todo](todo.md) (1-200 characters after trimming) → `Item N (ID): title must be 1-200 characters`
  - `completed` not a boolean → `Item N (ID): completed must be true/false`
  - `priority` not `low`/`medium`/`high` → `Item N (ID): priority must be low, medium, or high`
  - `dueDate` present (not null) and not a string valid per [todo](todo.md) → `Item N (ID): dueDate must be YYYY-MM-DD`
  - `notes` present (not null) and not a string → `Item N (ID): notes must be text`
  - `createdAt` not a valid timestamp → `Item N (ID): invalid createdAt`
  - an earlier valid item has the same id → `Item N (ID): duplicate id`
- A valid timestamp matches `YYYY-MM-DDTHH:MM:SS[.f{1,3}]Z`, with a real calendar date, hour < 24, minute and second < 60.
- Valid items are kept with the title trimmed, empty or null `dueDate`/`notes` dropped, and `updatedAt` defaulting to `createdAt` when missing or invalid. Unknown keys are ignored.
- Invalid items never block the valid ones. The confirmation shows `Found V valid todo(s)` plus ` and P problem(s)` when `P > 0`, then `.`, followed by every error.

## Applying

- `merge`: each imported todo replaces the existing todo with the same id in place; the rest are appended in import order.
- `replace`: the list becomes exactly the imported todos.
- Importing clears any pending undo and is not itself undoable. Afterwards the app shows `Imported N todo(s) (merge|replace).`

## UI

- The toolbar offers Export JSON, Export CSV and Import; export is disabled while the list is empty. Export saves or shares the file through the platform's file UI; import opens the platform file picker for JSON.
- The confirmation offers merge, replace and cancel. Merge and replace are disabled when there are no valid todos. Cancel changes nothing.

The `export-and-import` scenario runs on web only. iOS and Android use the system file pickers, which Maestro can't drive, so their scenario status is `missing` (REED-18).
