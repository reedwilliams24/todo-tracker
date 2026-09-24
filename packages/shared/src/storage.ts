import { SORTS, type TodoSort } from "./todos";
import type { Todo } from "./types";

export const STORAGE_KEY = "todo-tracker:todos:v1";
export const SORT_STORAGE_KEY = "todo-tracker:sort:v1";

export type MaybePromise<T> = T | Promise<T>;

/** Platform storage for the todo list (localStorage on web, AsyncStorage on mobile). */
export type TodoStorage = {
  load(): MaybePromise<Todo[]>;
  save(todos: readonly Todo[]): MaybePromise<void>;
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

export function parseStoredSort(raw: string | null | undefined): TodoSort {
  return SORTS.includes(raw as TodoSort) ? (raw as TodoSort) : "priority";
}
