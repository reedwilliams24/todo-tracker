# List

Fixtures: [`../fixtures/list.json`](../fixtures/list.json).

## Rules

- **Order of storage**: new todos are prepended, in the order they were drafted (`addTodos`).
- **Display sort** (`sortTodos(todos, sort)`): `sort` is `priority` (default), `due` or `manual`, chosen in the UI's sort control and persisted (see [storage](storage.md)).
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
  - `manual`: storage order, unchanged.
- **Reorder** (`moveVisibleTodo(todos, visibleIds, id, targetId)`): moves `id` into `targetId`'s slot within the rows currently shown (`visibleIds`, in display order) and writes that display order back to storage order. Todos that are not shown keep their storage slots. Unknown ids, or dropping a row on itself, change nothing. `reorderTodos(todos, from, to)` is the index-based helper; out-of-range indexes change nothing.
- Reordering switches the sort to `manual` so the new order is what the user sees. It is not undoable and keeps any pending undo (reducer action `reorder`).
- Reordering is disabled while a search query is active.
- **UI**: web drags a row (HTML drag and drop) onto another row; iOS and Android long-press a row and drag it. Web shortcuts: `/` focuses search (unless typing in a field), `Esc` clears and blurs search, `Enter` in the form adds.
- **Filter**: `all | active | completed`.
- **Search**: case-insensitive substring match on title or notes. The query is trimmed; a blank query matches everything. Search applies after the status filter.
- **Remaining**: number of todos that are not completed. Shown as `1 task remaining` / `N tasks remaining`.
- **Delete** removes by id; unknown ids are ignored. **Clear completed** removes every completed todo.
- **Completed count** (`countCompleted`): number of completed todos. The clear button reads `Clear completed (N)` and only shows when N > 0.
- **Bulk toggle** (`bulkToggle`): if any selected todo is active, every selected todo becomes complete; if all are already complete, they all become active. Unknown ids are ignored and unselected todos are untouched (their `updatedAt` too).
- **Bulk select (UI)**: a `Select` toggle (shown when the list has todos) enters select mode. Rows show a select checkbox instead of the complete checkbox and edit/delete controls are hidden. A bar shows `N selected`, `Select all` / `Select none` (over the visible rows), `Toggle complete` and `Delete`; both actions are disabled with nothing selected. Selection only counts visible rows (filter and search apply). `Delete` asks for confirmation (`Delete N todo(s)?` with Delete / Cancel) before removing. Both actions leave select mode. `Clear completed` is hidden in select mode.
