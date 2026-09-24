import { STORAGE_KEY, parseStoredTodos, serializeTodos, type TodoStorage } from "@todo/shared";

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
