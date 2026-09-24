import { createTodo, toggleTodo, updateTodoText } from "./todos";
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

export function reorderTodos(todos: readonly Todo[], fromIndex: number, toIndex: number): Todo[] {
  const next = [...todos];
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= next.length ||
    toIndex >= next.length
  ) {
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
