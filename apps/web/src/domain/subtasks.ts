import { scheduleNext } from "./recurrence";
import { generateId, isValidTitle, updateTodo } from "./todos";
import type { Subtask, Todo } from "./types";

export function subtaskProgress(todo: Todo): { done: number; total: number } {
  const subtasks = todo.subtasks ?? [];
  return { done: subtasks.filter((s) => s.completed).length, total: subtasks.length };
}

/** Appends a trimmed subtask; blank or over-long titles are ignored. */
export function addSubtask(todo: Todo, title: string, now: Date = new Date()): Todo {
  if (!isValidTitle(title)) return todo;
  const subtask: Subtask = { id: generateId(), title: title.trim(), completed: false };
  return updateTodo(todo, { subtasks: [...(todo.subtasks ?? []), subtask] }, now);
}

/**
 * Toggles one subtask. When every subtask ends up done the parent is completed;
 * un-checking a subtask reopens a completed parent (`completedAt` follows, as in
 * `toggleTodo`). Unknown ids change nothing.
 */
export function toggleSubtask(todo: Todo, subtaskId: string, now: Date = new Date()): Todo {
  if (!todo.subtasks?.some((s) => s.id === subtaskId)) return todo;
  const subtasks = todo.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s));
  const completed = subtasks.every((s) => s.completed);
  if (completed === todo.completed) return updateTodo(todo, { subtasks }, now);
  return updateTodo(todo, { subtasks, completed, completedAt: completed ? now.toISOString() : undefined }, now);
}

/** Toggles a subtask in the list; completing a recurring parent inserts its next occurrence right after it. */
export function toggleSubtaskInList(
  todos: readonly Todo[],
  id: string,
  subtaskId: string,
  now: Date = new Date(),
): Todo[] {
  return todos.flatMap((todo) => {
    if (todo.id !== id) return [todo];
    const toggled = toggleSubtask(todo, subtaskId, now);
    const next = toggled.completed && !todo.completed ? scheduleNext(toggled, now) : undefined;
    return next ? [toggled, next] : [toggled];
  });
}

/** Removes one subtask; the list is dropped when it becomes empty. The parent's completion is unchanged. */
export function removeSubtask(todo: Todo, subtaskId: string, now: Date = new Date()): Todo {
  if (!todo.subtasks?.some((s) => s.id === subtaskId)) return todo;
  const subtasks = todo.subtasks.filter((s) => s.id !== subtaskId);
  return updateTodo(todo, { subtasks: subtasks.length ? subtasks : undefined }, now);
}
