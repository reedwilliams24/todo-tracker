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
- **Remaining**: number of todos that are not completed. Shown as `1 task remaining` / `N tasks remaining`.
- **Delete** removes by id; unknown ids are ignored. **Clear completed** removes every completed todo.
