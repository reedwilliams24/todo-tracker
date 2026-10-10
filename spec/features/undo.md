# Undo

Fixtures: [`../fixtures/undo.json`](../fixtures/undo.json). The `applyActions` op drives the list reducer (`reduceTodos` in `packages/shared/src/store.ts`) through a sequence of user actions and reports `{ todos, undoLabel }`.

## Rules

- Completing a todo, deleting todos, and clear completed each take a snapshot of the **whole list** before the change. Undo restores that snapshot exactly, including order.
- Only the latest snapshot is kept. A new undoable action replaces it; undo clears it.
- Reopening a completed todo, renaming and adding are not undoable and leave the current snapshot alone.
- An action that changes nothing (deleting an unknown id, clear completed with nothing completed) does not offer undo.
- Labels: `Completed todo`, `Completed N todos`, `Deleted todo`, `Deleted N todos`.
- The undo toast expires `5000` ms after the action (expired when `now - at >= 5000`).
