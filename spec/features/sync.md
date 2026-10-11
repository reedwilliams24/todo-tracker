# Sync

Fixtures: [`../fixtures/sync.json`](../fixtures/sync.json). Ticket: REED-65 (parent plan REED-61).

The pure rules every client uses to keep its local list in step with the backend `todos` table. No network or UI here: the clients call these functions on top of the [server contract](../server.md) (REED-62). The persisted offline outbox (`enqueue`, `ackPush`) is REED-77.

## Row

- **Columns** (`syncConstants.columns`, in this order): `id`, `user_id`, `title`, `notes`, `completed`, `priority`, `due_date`, `recurrence`, `completed_at`, `created_at`, `updated_at`, `deleted_at`, `server_seq`.
- **Timestamps** use the Todo format, UTC ISO-8601 with milliseconds and `Z` (`2026-01-05T09:00:00.000Z`). The server must return them in that form, because `updated_at` is compared as a string.
- `deleted_at` is the tombstone: non-null means the todo was deleted. `server_seq` is assigned by the server on every write and is strictly increasing. It is `null` on rows the client builds.
- `reminder` is **not** a column. It stays a per-device notification setting (see Apply).
- **`toRow(todo, userId, deletedAt?)`**: camelCase todo fields map to the snake_case columns. Unset optional fields (`notes`, `due_date`, `recurrence`, `completed_at`) become `null`; every column is always present, so a push can clear a field. `deleted_at` is `deletedAt` when given (a delete), else `null`. `server_seq` is `null`.
- **`fromRow(row)`**: the reverse. `null` columns are left out of the todo. `user_id`, `deleted_at` and `server_seq` are dropped.
- Fixtures can't hold `null` values, so row results are written as `{ row, nulls }`: `row` has the non-null columns and `nulls` lists the null ones, sorted. Together they always name all 13 columns.

## Apply (`applyRemote(local, inFlight, rows, cursor)`)

`rows` come from a pull (`server_seq > cursor`, ordered by `server_seq`) or from Realtime events, and are applied one at a time in the given order. `inFlight` holds the local versions of todos whose push hasn't been answered yet.

1. A row whose `server_seq` is `null` or at or below `cursor` is ignored. That covers Realtime echoes of rows already pulled.
2. A **tombstone** removes the todo from the list. It always wins, even over a newer local or in-flight edit. A tombstone for a todo that isn't in the list does nothing.
3. Otherwise **last writer wins** on `updated_at` for the whole todo:
   - If the todo has an in-flight push with a newer `updated_at`, the row is ignored and the local edit is kept.
   - If the local copy has a newer `updated_at`, the row is ignored.
   - **Ties go to the server**: an equal `updated_at` (against the local copy or the in-flight edit) takes the row.
4. A winning row replaces the local todo in place, or is added at the top of the list if it is new (like a local add).
5. The replaced todo keeps its device-local `reminder` as long as the row has a due date (a reminder needs one). If the row clears the due date, the reminder is dropped.
6. Subtasks aren't a column yet, so the replaced todo also keeps its device-local `subtasks`.

The echo of our own push (same `updated_at` and fields) therefore leaves the list unchanged.

## Push (`planPush(before, after, tombstoned, userId, now)`)

Every signed-in edit (`before` is the list before it, `after` the list the reducer produced) is pushed right away. `planPush` returns `{ todos, rows }`: the list to show and the rows to send.

- A todo in `after` that isn't in `before` (an add) becomes a row.
- A todo whose synced columns changed becomes a row. If its `updated_at` didn't move forward (an undo restored an older version), it is stamped `now` so it wins LWW on the server.
- A change to `reminder` or `subtasks` alone, or a reorder, pushes nothing: those are device-local.
- A todo in `before` that isn't in `after` becomes a tombstone with `deleted_at` = `updated_at` = `now`.
- A todo that comes back after its tombstone was pushed (undo of a delete; its id is in `tombstoned`) gets a fresh `id` and `updated_at` = `now`, because a tombstone always wins.

The client keeps the edit's todos as in-flight until the push answers. On success it applies the returned stored rows with `applyRemote(…, cursor: 0)` and leaves the cursor alone (rows from other devices may sit between the cursor and ours). On failure it calls `rollbackPush(current, before, rowIds)` and shows an error.

## Cursor (`advanceCursor(cursor, rows)`)

The new cursor is the highest `server_seq` among `rows` and `cursor`. It never moves backwards, and rows without a `server_seq` don't count. The first pull starts at `0`.

## Failed push (`rollbackPush(local, before, failedIds)`)

In v1 a signed-in write needs a connection; if its push fails, the edit is undone. `before` is the list as it was before the edit. Each failed id:

- that was in `before` and is still in the list goes back to its `before` version, in place;
- that wasn't in `before` (a new todo that was never saved) is removed;
- that was in `before` but is no longer in the list (a delete that failed) is put back right after the nearest todo that preceded it in `before`, or at the top if none is left.

Todos that are not in `failedIds` are left alone, including other edits made since.

## Move guest todos (`guestToRows(guest, userId, now)`)

When a user signs in with guest todos and picks **Move**, every guest todo becomes a new account row, in list order. Each row gets a fresh `id` (so it never overwrites an account todo), `user_id` = `userId` and `updated_at` = `now`. All other fields are kept. Nothing is de-duplicated: if the same todo already exists in the account, there will be two copies (accepted in REED-61).
