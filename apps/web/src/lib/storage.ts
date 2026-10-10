import {
  SORT_STORAGE_KEY,
  STORAGE_KEY,
  parseStoredTodos,
  serializeTodos,
  type TodoStorage,
} from "@todo/shared";
import type { PreferenceStorage } from "@todo/shared/react";

export const localTodoStorage: TodoStorage = {
  load() {
    if (typeof window === "undefined") return [];
    try {
      return parseStoredTodos(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  },
  save(todos) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeTodos(todos));
    } catch {
      // storage unavailable (private mode, quota) - keep state in memory only
    }
  },
};

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
