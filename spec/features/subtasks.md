# Subtasks

Fixtures: [`../fixtures/subtasks.json`](../fixtures/subtasks.json). Shape: `subtasks` in [`../schema/todo.schema.json`](../schema/todo.schema.json). Ticket: REED-10.

## Rules

- A todo may have an ordered checklist of subtasks `{ id, title, completed }`. The `subtasks` key is omitted when the list is empty; it is never stored as `[]`.
- `subtaskProgress` is `{ done, total }`: the number of completed subtasks and the number of subtasks. UI shows it as `done/total` (for example `1/2`).
- Adding trims the title and appends it, not completed, with a new id. Titles follow the todo title rules (`isValidTitle`); invalid titles change nothing. Adding never changes the parent's `completed`.
- Toggling flips one subtask. Afterwards the parent's `completed` is `true` exactly when every subtask is completed: checking the last open subtask completes the parent, and unchecking any subtask reopens it. When this changes the parent's `completed`, `completedAt` follows the same rule as `toggleTodo` (set to `now` on completion, cleared on reopen); completing a recurring parent this way schedules its next occurrence right after it, exactly like toggling the todo (see [`recurrence.md`](recurrence.md)).
- Removing deletes one subtask. The parent's `completed` is unchanged.
- An unknown todo id or subtask id changes nothing (same object, `updatedAt` untouched). Any real change sets the parent's `updatedAt` to `now`.
- Undo: when toggling a subtask completes its parent, undo is offered with the label `Completed todo` and restores the whole list (see [`undo.md`](undo.md)). Adding, removing, and toggles that don't complete the parent are not undoable and leave the current snapshot alone.
- Storage: subtasks are saved with their todo under the same key (see [`storage.md`](storage.md)).
- UI: each todo row has a toggle that expands its subtasks and shows the progress (`itemSubtasksToggle`, `itemSubtaskProgress`). The expanded panel lists subtasks (`subtask`, `subtaskToggle`, `subtaskDelete`, keyed by the subtask title) and has an input that adds on Enter (`subtaskInput`, keyed by the todo title).
