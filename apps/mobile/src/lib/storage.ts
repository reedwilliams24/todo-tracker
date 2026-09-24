import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEY, parseStoredTodos, serializeTodos, type TodoStorage } from "@todo/shared";

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
