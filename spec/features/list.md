# List

Fixtures: [`../fixtures/list.json`](../fixtures/list.json).

## Rules

- **Order of storage**: new todos are prepended, in the order they were drafted (`addTodos`).
- **Display sort** (`sortTodos(todos, sort)`, used everywhere todos are shown). `sort` is `priority` (default) or `due`, chosen in the UI's sort control; the choice is not persisted.
  - `priority` (`sortByPriority`):
    1. Active before completed.
    2. Priority high → medium → low.
    3. Due date ascending; undated todos after dated ones.
    4. `createdAt` ascending (older first).
  - `due` (`sortByDue`):
    1. Active before completed.
    2. Due date ascending; undated todos after dated ones.
    3. Priority high → medium → low.
    4. `createdAt` ascending (older first).
- **Filter**: `all | active | completed`.
- **Search**: case-insensitive substring match on title or notes. The query is trimmed; a blank query matches everything. Search applies after the status filter.
- **Remaining**: number of todos that are not completed. Shown with the `list.remaining` message (`1 task remaining` / `N tasks remaining`; see [localization](localization.md)).
- **Delete** removes by id; unknown ids are ignored. **Clear completed** removes every completed todo.
- **Completed count** (`countCompleted`): number of completed todos. The clear button reads `Clear completed (N)` and only shows when N > 0.
- **Bulk toggle** (`bulkToggle`): if any selected todo is active, every selected todo becomes complete; if all are already complete, they all become active. Unknown ids are ignored and unselected todos are untouched (their `updatedAt` too).
- **Bulk select (UI)**: a `Select` toggle (shown when the list has todos) enters select mode. Rows show a select checkbox instead of the complete checkbox and edit/delete controls are hidden. A bar shows `N selected`, `Select all` / `Select none` (over the visible rows), `Toggle complete` and `Delete`; both actions are disabled with nothing selected. Selection only counts visible rows (filter and search apply). `Delete` asks for confirmation (`Delete N todo(s)?` with Delete / Cancel) before removing. Both actions leave select mode. `Clear completed` is hidden in select mode.
