import { scheduleNext } from "./recurrence";
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

/** Toggles a todo; completing a recurring todo inserts its next occurrence right after it. */
export function toggleInList(todos: readonly Todo[], id: string, now: Date = new Date()): Todo[] {
  return todos.flatMap((todo) => {
    if (todo.id !== id) return [todo];
    const toggled = toggleTodo(todo, now);
    const next = toggled.completed ? scheduleNext(toggled, now) : undefined;
    return next ? [toggled, next] : [toggled];
  });
}

export function renameInList(todos: readonly Todo[], id: string, title: string, now: Date = new Date()): Todo[] {
  return updateTodoText(todos, id, title, now);
}

export function removeFromList(todos: readonly Todo[], ids: readonly string[]): Todo[] {
  const doomed = new Set(ids);
  return todos.filter((todo) => !doomed.has(todo.id));
}

export function clearCompletedInList(todos: readonly Todo[]): Todo[] {
  return todos.filter((todo) => !todo.completed);
}

export function countCompleted(todos: readonly Todo[]): number {
  return todos.filter((todo) => todo.completed).length;
}

/**
 * Completes every todo in `ids`, or reopens them all when every selected todo
 * is already complete. Unknown ids are ignored; other todos are untouched.
 */
export function bulkToggle(todos: readonly Todo[], ids: readonly string[], now: Date = new Date()): Todo[] {
  const chosen = new Set(ids);
  const selected = todos.filter((todo) => chosen.has(todo.id));
  if (selected.length === 0) return [...todos];
  const complete = selected.some((todo) => !todo.completed);
  return todos.map((todo) => (chosen.has(todo.id) && todo.completed !== complete ? toggleTodo(todo, now) : todo));
}

export function reorderTodos(todos: readonly Todo[], fromIndex: number, toIndex: number): Todo[] {
  const next = [...todos];
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length) {
    return next;
  }
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

/**
 * Reorders the stored list so that the currently visible rows (`visibleIds`, in
 * display order) keep their display order with `id` moved to `targetId`'s slot.
 * Hidden todos stay where they are.
 */
export function moveVisibleTodo(
  todos: readonly Todo[],
  visibleIds: readonly string[],
  id: string,
  targetId: string,
): Todo[] {
  const from = visibleIds.indexOf(id);
  const to = visibleIds.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return [...todos];
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const ordered = reorderTodos(
    visibleIds.map((visibleId) => byId.get(visibleId)).filter((todo): todo is Todo => !!todo),
    from,
    to,
  );
  const visible = new Set(visibleIds);
  let next = 0;
  return todos.map((todo) => (visible.has(todo.id) ? ordered[next++]! : todo));
}
