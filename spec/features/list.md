# List

Fixtures: [`../fixtures/list.json`](../fixtures/list.json).

## Rules

- **Order of storage**: new todos are prepended, in the order they were drafted (`addTodos`).
- **Display sort** (`sortByPriority`, used everywhere todos are shown):
  1. Active before completed.
  2. Priority high → medium → low.
  3. Due date ascending; undated todos after dated ones.
  4. `createdAt` ascending (older first).
- **Filter**: `all | active | completed`.
- **Search**: case-insensitive substring match on title or notes. The query is trimmed; a blank query matches everything. Search applies after the status filter.
- **Remaining**: number of todos that are not completed. Shown as `1 task remaining` / `N tasks remaining`.
- **Delete** removes by id; unknown ids are ignored. **Clear completed** removes every completed todo.
