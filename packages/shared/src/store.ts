import { clearCompletedInList, removeFromList, renameInList, toggleInList } from "./list";
import type { Todo } from "./types";
import { createUndoEntry, describeUndo, isUndoExpired, type UndoEntry } from "./undo";

/** In-memory todo list state shared by every client; persistence and timers live in the platform layer. */
export type TodoState = { todos: Todo[]; undoable: UndoEntry | null };

export type TodoAction =
  | { type: "load"; todos: Todo[] }
  | { type: "prepend"; todos: Todo[] }
  | { type: "toggle"; id: string }
  | { type: "rename"; id: string; title: string }
  | { type: "remove"; ids: string[] }
  | { type: "clearCompleted" }
  | { type: "undo" }
  | { type: "expireUndo" };

export const INITIAL_TODO_STATE: TodoState = { todos: [], undoable: null };

/** Pure state transition for the todo list, including the undo snapshot. */
export function reduceTodos(state: TodoState, action: TodoAction, now: Date = new Date()): TodoState {
  const { todos } = state;
  const snapshot = (label: string) => createUndoEntry(label, todos, now.getTime());

  switch (action.type) {
    case "load":
      return { ...state, todos: action.todos };
    case "prepend":
      return { ...state, todos: [...action.todos, ...todos] };
    case "toggle": {
      const target = todos.find((todo) => todo.id === action.id);
      const undoable = target && !target.completed ? snapshot(describeUndo("complete", 1)) : state.undoable;
      return { todos: toggleInList(todos, action.id, now), undoable };
    }
    case "rename":
      return { ...state, todos: renameInList(todos, action.id, action.title, now) };
    case "remove": {
      const next = removeFromList(todos, action.ids);
      if (next.length === todos.length) return state;
      return { todos: next, undoable: snapshot(describeUndo("delete", action.ids.length)) };
    }
    case "clearCompleted": {
      const next = clearCompletedInList(todos);
      const removed = todos.length - next.length;
      if (removed === 0) return state;
      return { todos: next, undoable: snapshot(describeUndo("delete", removed)) };
    }
    case "undo":
      return state.undoable ? { todos: [...state.undoable.before], undoable: null } : state;
    case "expireUndo":
      return state.undoable && isUndoExpired(state.undoable, now.getTime()) ? { ...state, undoable: null } : state;
  }
}
