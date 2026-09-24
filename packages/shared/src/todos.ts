import type { Todo, TodoDraft, TodoFilter, TodoPriority } from "./types";

export const DEFAULT_PRIORITY: TodoPriority = "medium";

export const PRIORITY_ORDER: Record<Todo["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Accepts an empty value or a real calendar date in YYYY-MM-DD form. */
export function isValidDueDate(value: string | undefined): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function generateId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTodo(draft: TodoDraft, now: Date = new Date()): Todo {
  const timestamp = now.toISOString();
  return {
    id: generateId(),
    title: draft.title.trim(),
    notes: draft.notes?.trim() || undefined,
    completed: false,
    priority: draft.priority ?? DEFAULT_PRIORITY,
    dueDate: draft.dueDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateTodo(
  todo: Todo,
  patch: Partial<Omit<Todo, "id" | "createdAt">>,
  now: Date = new Date(),
): Todo {
  return { ...todo, ...patch, updatedAt: now.toISOString() };
}

export function updateTodoText(
  todos: readonly Todo[],
  id: string,
  text: string,
  now: Date = new Date(),
): Todo[] {
  if (!isValidTitle(text)) return [...todos];
  const title = text.trim();
  return todos.map((todo) =>
    todo.id === id && todo.title !== title ? updateTodo(todo, { title }, now) : todo,
  );
}

export function toggleTodo(todo: Todo, now: Date = new Date()): Todo {
  return updateTodo(todo, { completed: !todo.completed }, now);
}

export function filterTodos(todos: readonly Todo[], filter: TodoFilter): Todo[] {
  switch (filter) {
    case "active":
      return todos.filter((todo) => !todo.completed);
    case "completed":
      return todos.filter((todo) => todo.completed);
    default:
      return [...todos];
  }
}

export function searchTodos(todos: readonly Todo[], query: string): Todo[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...todos];
  return todos.filter(
    (todo) =>
      todo.title.toLowerCase().includes(needle) ||
      (todo.notes?.toLowerCase().includes(needle) ?? false),
  );
}

export function sortTodos(todos: readonly Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (byPriority !== 0) return byPriority;
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export function countRemaining(todos: readonly Todo[]): number {
  return todos.reduce((total, todo) => (todo.completed ? total : total + 1), 0);
}

export function isValidTitle(title: string): boolean {
  return title.trim().length > 0 && title.trim().length <= 200;
}
