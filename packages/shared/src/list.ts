import { createTodo, toggleTodo, updateTodo } from "./todos";
import type { Todo, TodoDraft } from "./types";

export function addTodos(todos: readonly Todo[], drafts: readonly TodoDraft[]): { todos: Todo[]; created: Todo[] } {
  const created = drafts.map((draft) => createTodo(draft));
  return { todos: [...created, ...todos], created };
}

export function toggleInList(todos: readonly Todo[], id: string): Todo[] {
  return todos.map((todo) => (todo.id === id ? toggleTodo(todo) : todo));
}

export function renameInList(todos: readonly Todo[], id: string, title: string): Todo[] {
  return todos.map((todo) => (todo.id === id ? updateTodo(todo, { title: title.trim() }) : todo));
}

export function removeFromList(todos: readonly Todo[], ids: readonly string[]): Todo[] {
  const doomed = new Set(ids);
  return todos.filter((todo) => !doomed.has(todo.id));
}

export function clearCompletedInList(todos: readonly Todo[]): Todo[] {
  return todos.filter((todo) => !todo.completed);
}
