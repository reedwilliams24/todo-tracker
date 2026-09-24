import type { Todo } from "@todo/shared";

const STORAGE_KEY = "todo-tracker:todos:v1";

export function loadTodos(): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Todo[]) : [];
  } catch {
    return [];
  }
}

export function saveTodos(todos: readonly Todo[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // storage unavailable (private mode, quota) - keep state in memory only
  }
}
