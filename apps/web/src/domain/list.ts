import { createTodo, toggleTodo, updateTodoText } from "./todos";
import type { Todo, TodoDraft } from "./types";

export function addTodos(
  todos: readonly Todo[],
  drafts: readonly TodoDraft[],
  now: Date = new Date(),
): { todos: Todo[]; created: Todo[] } {
  const created = drafts.map((draft) => createTodo(draft, now));
  return { todos: [...created, ...todos], created };
}

export function toggleInList(todos: readonly Todo[], id: string, now: Date = new Date()): Todo[] {
  return todos.map((todo) => (todo.id === id ? toggleTodo(todo, now) : todo));
}

export function renameInList(
  todos: readonly Todo[],
  id: string,
  title: string,
  now: Date = new Date(),
): Todo[] {
  return updateTodoText(todos, id, title, now);
}

export function removeFromList(todos: readonly Todo[], ids: readonly string[]): Todo[] {
  const doomed = new Set(ids);
  return todos.filter((todo) => !doomed.has(todo.id));
}

export function clearCompletedInList(todos: readonly Todo[]): Todo[] {
  return todos.filter((todo) => !todo.completed);
}
