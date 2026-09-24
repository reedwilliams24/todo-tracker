import { createTodo, toggleTodo, updateTodo, updateTodoText } from "./todos";
import type { Todo, TodoDraft } from "./types";

export function addTodos(todos: readonly Todo[], drafts: readonly TodoDraft[]): { todos: Todo[]; created: Todo[] } {
  const created = drafts.map((draft) => createTodo(draft));
  return { todos: [...created, ...todos], created };
}

export function toggleInList(todos: readonly Todo[], id: string): Todo[] {
  return todos.map((todo) => (todo.id === id ? toggleTodo(todo) : todo));
}

export function renameInList(todos: readonly Todo[], id: string, title: string): Todo[] {
  return updateTodoText(todos, id, title);
}

export function removeFromList(todos: readonly Todo[], ids: readonly string[]): Todo[] {
  const doomed = new Set(ids);
  return todos.filter((todo) => !doomed.has(todo.id));
}

export function clearCompletedInList(todos: readonly Todo[]): Todo[] {
  return todos.filter((todo) => !todo.completed);
}

export const clearCompleted = clearCompletedInList;

export function countCompleted(todos: readonly Todo[]): number {
  return todos.filter((todo) => todo.completed).length;
}

/**
 * Marks `ids` complete, or — when every selected todo is already complete —
 * marks them all active. Unlisted todos are untouched.
 */
export function bulkToggle(todos: readonly Todo[], ids: readonly string[], now: Date = new Date()): Todo[] {
  const chosen = new Set(ids);
  const selected = todos.filter((todo) => chosen.has(todo.id));
  if (selected.length === 0) return [...todos];
  const completed = !selected.every((todo) => todo.completed);
  return todos.map((todo) =>
    chosen.has(todo.id) && todo.completed !== completed ? updateTodo(todo, { completed }, now) : todo,
  );
}

export const bulkDelete = removeFromList;
