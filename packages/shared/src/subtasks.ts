import { generateId, isValidTitle, updateTodo } from "./todos";
import type { Subtask, Todo } from "./types";

export function subtaskProgress(todo: Todo): { done: number; total: number } {
  const subtasks = todo.subtasks ?? [];
  return { done: subtasks.filter((s) => s.completed).length, total: subtasks.length };
}

export function addSubtask(todo: Todo, title: string, now: Date = new Date()): Todo {
  if (!isValidTitle(title)) return todo;
  const subtask: Subtask = { id: generateId(), title: title.trim(), completed: false };
  return updateTodo(todo, { subtasks: [...(todo.subtasks ?? []), subtask] }, now);
}

/**
 * Toggles one subtask. When `completeParent` (default) and every subtask ends up
 * done, the parent is completed too; un-checking a subtask reopens a completed parent.
 */
export function toggleSubtask(
  todo: Todo,
  subtaskId: string,
  completeParent = true,
  now: Date = new Date(),
): Todo {
  const subtasks = (todo.subtasks ?? []).map((s) =>
    s.id === subtaskId ? { ...s, completed: !s.completed } : s,
  );
  if (!subtasks.some((s) => s.id === subtaskId)) return todo;
  const patch: Partial<Todo> = { subtasks };
  if (completeParent) {
    const allDone = subtasks.length > 0 && subtasks.every((s) => s.completed);
    if (allDone !== todo.completed) patch.completed = allDone;
  }
  return updateTodo(todo, patch, now);
}

export function removeSubtask(todo: Todo, subtaskId: string, now: Date = new Date()): Todo {
  const subtasks = (todo.subtasks ?? []).filter((s) => s.id !== subtaskId);
  if (subtasks.length === (todo.subtasks ?? []).length) return todo;
  return updateTodo(todo, { subtasks: subtasks.length ? subtasks : undefined }, now);
}
