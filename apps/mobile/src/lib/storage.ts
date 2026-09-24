import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SORT_STORAGE_KEY,
  STORAGE_KEY,
  parseStoredTodos,
  serializeTodos,
  type TodoStorage,
} from "@todo/shared";
import type { PreferenceStorage } from "@todo/shared/react";

export const asyncTodoStorage: TodoStorage = {
  async load() {
    try {
      return parseStoredTodos(await AsyncStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  },
  async save(todos) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, serializeTodos(todos));
    } catch {
      // storage unavailable - keep state in memory only
    }
  },
};

export const asyncSortStorage: PreferenceStorage = {
  async load() {
    try {
      return await AsyncStorage.getItem(SORT_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  async save(value) {
    try {
      await AsyncStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // storage unavailable - keep state in memory only
    }
  },
};
