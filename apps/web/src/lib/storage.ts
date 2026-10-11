import {
  ACCOUNT_STORAGE_KEY,
  SORT_STORAGE_KEY,
  STORAGE_KEY,
  parseStoredTodos,
  serializeTodos,
  type TodoStorage,
} from "@/domain";
import type { PreferenceStorage } from "@/domain/react";

function keyedTodoStorage(key: string): TodoStorage {
  return {
    load() {
      if (typeof window === "undefined") return [];
      try {
        return parseStoredTodos(window.localStorage.getItem(key));
      } catch {
        return [];
      }
    },
    save(todos) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, serializeTodos(todos));
      } catch {
        // storage unavailable (private mode, quota) - keep state in memory only
      }
    },
  };
}

/** The guest list (signed out, or a build without Supabase). */
export const localTodoStorage = keyedTodoStorage(STORAGE_KEY);
/** The signed-in account's local cache (spec/features/auth.md). */
export const accountTodoStorage = keyedTodoStorage(ACCOUNT_STORAGE_KEY);

export const localSortStorage: PreferenceStorage = {
  load() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(SORT_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  save(value) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // storage unavailable - keep state in memory only
    }
  },
};
