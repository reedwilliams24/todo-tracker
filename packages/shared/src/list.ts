import { scheduleNext } from "./recurrence";
import { createTodo, toggleTodo, updateTodoText } from "./todos";
import type { Todo, TodoDraft } from "./types";

export function addTodos(todos: readonly Todo[], drafts: readonly TodoDraft[]): { todos: Todo[]; created: Todo[] } {
  const created = drafts.map((draft) => createTodo(draft));
  return { todos: [...created, ...todos], created };
}

/** Toggles a todo; completing a recurring todo inserts its next occurrence right after it. */
export function toggleInList(todos: readonly Todo[], id: string, now: Date = new Date()): Todo[] {
  return todos.flatMap((todo) => {
    if (todo.id !== id) return [todo];
    const toggled = toggleTodo(todo, now);
    const next = toggled.completed ? scheduleNext(toggled, now) : undefined;
    return next ? [toggled, next] : [toggled];
  });
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
