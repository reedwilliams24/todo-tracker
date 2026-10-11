import {
  bulkToggle,
  clearCompletedInList,
  moveVisibleTodo,
  removeFromList,
  renameInList,
  toggleInList,
  updateInList,
} from "./list";
import { addSubtask, removeSubtask, toggleSubtaskInList } from "./subtasks";
import type { Todo } from "./types";
import { createUndoEntry, describeUndo, isUndoExpired, type UndoEntry } from "./undo";

/** In-memory todo list state shared by every client; persistence and timers live in the platform layer. */
export type TodoState = { todos: Todo[]; undoable: UndoEntry | null };

export type TodoAction =
  | { type: "load"; todos: Todo[] }
  | { type: "prepend"; todos: Todo[] }
  | { type: "toggle"; id: string }
  | { type: "toggleMany"; ids: string[] }
  | { type: "rename"; id: string; title: string }
  | { type: "remove"; ids: string[] }
  | { type: "reorder"; visibleIds: string[]; id: string; targetId: string }
  | { type: "clearCompleted" }
  | { type: "addSubtask"; id: string; title: string }
  | { type: "toggleSubtask"; id: string; subtaskId: string }
  | { type: "removeSubtask"; id: string; subtaskId: string }
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
    case "toggleMany": {
      const next = bulkToggle(todos, action.ids, now);
      const completed = next.filter((todo, i) => todo.completed && !todos[i]!.completed).length;
      if (next.every((todo, i) => todo === todos[i])) return state;
      return { todos: next, undoable: completed > 0 ? snapshot(describeUndo("complete", completed)) : state.undoable };
    }
    case "rename":
      return { ...state, todos: renameInList(todos, action.id, action.title, now) };
    case "remove": {
      const next = removeFromList(todos, action.ids);
      if (next.length === todos.length) return state;
      return { todos: next, undoable: snapshot(describeUndo("delete", action.ids.length)) };
    }
    case "reorder": {
      const next = moveVisibleTodo(todos, action.visibleIds, action.id, action.targetId);
      return next.every((todo, index) => todo === todos[index]) ? state : { ...state, todos: next };
    }
    case "clearCompleted": {
      const next = clearCompletedInList(todos);
      const removed = todos.length - next.length;
      if (removed === 0) return state;
      return { todos: next, undoable: snapshot(describeUndo("delete", removed)) };
    }
    case "addSubtask":
      return { ...state, todos: updateInList(todos, action.id, (todo) => addSubtask(todo, action.title, now)) };
    case "toggleSubtask": {
      const next = toggleSubtaskInList(todos, action.id, action.subtaskId, now);
      const before = todos.find((todo) => todo.id === action.id);
      const after = next.find((todo) => todo.id === action.id);
      const completedParent = before && after && !before.completed && after.completed;
      return { todos: next, undoable: completedParent ? snapshot(describeUndo("complete", 1)) : state.undoable };
    }
    case "removeSubtask":
      return { ...state, todos: updateInList(todos, action.id, (todo) => removeSubtask(todo, action.subtaskId, now)) };
    case "undo":
      return state.undoable ? { todos: [...state.undoable.before], undoable: null } : state;
    case "expireUndo":
      return state.undoable && isUndoExpired(state.undoable, now.getTime()) ? { ...state, undoable: null } : state;
  }
}
