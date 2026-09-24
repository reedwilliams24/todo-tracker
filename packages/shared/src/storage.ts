import type { Todo } from "./types";

export const STORAGE_KEY = "todo-tracker:todos:v1";

export type MaybePromise<T> = T | Promise<T>;

/** Platform storage for the todo list (localStorage on web, AsyncStorage on mobile). */
export type TodoStorage = {
  load(): MaybePromise<Todo[]>;
  save(todos: readonly Todo[]): MaybePromise<void>;
  /** Optional: notify when the list changes outside this client (another device). */
  subscribe?(onChange: (todos: Todo[]) => void): () => void;
};

export function serializeTodos(todos: readonly Todo[]): string {
  return JSON.stringify(todos);
}

export function parseStoredTodos(raw: string | null | undefined): Todo[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Todo[]) : [];
  } catch {
    return [];
  }
}
