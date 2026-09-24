import { useMemo } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTodos as useSharedTodos } from "@todo/shared/react";
import { createOfflineFirstStorage, type TodoStorage } from "@todo/shared";
import { asyncTodoStorage } from "../lib/storage";
import { supabase, todoTable } from "../lib/supabase";
import type { AuthUser } from "./use-auth";

function accountStorage(user: AuthUser): TodoStorage {
  if (!supabase) return asyncTodoStorage;
  return createOfflineFirstStorage({
    table: todoTable(supabase),
    userId: user.id,
    store: {
      get: (key) => AsyncStorage.getItem(key),
      set: (key, value) => AsyncStorage.setItem(key, value),
    },
    seed: asyncTodoStorage,
    // No connectivity API without a native module; re-sync whenever the app comes to the foreground.
    onOnline: (callback) => {
      const sub = AppState.addEventListener("change", (s) => s === "active" && callback());
      return () => sub.remove();
    },
  });
}

export function useTodos(user: AuthUser | null = null) {
  const storage = useMemo(() => (user ? accountStorage(user) : asyncTodoStorage), [user]);
  return useSharedTodos(storage);
}
