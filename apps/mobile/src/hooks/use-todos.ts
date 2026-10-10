import { useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTodos as useSharedTodos } from "@todo/shared/react";
import { createCloudTodoStorage, withFirstSignInMigration, type TodoStorage } from "@todo/shared";
import { asyncTodoStorage } from "../lib/storage";
import { supabase, todoTable } from "../lib/supabase";
import type { AuthUser } from "./use-auth";

function accountStorage(user: AuthUser): TodoStorage {
  if (!supabase) return asyncTodoStorage;
  const key = `todo-tracker:migrated:${user.id}`;
  return withFirstSignInMigration(
    createCloudTodoStorage(todoTable(supabase), user.id),
    asyncTodoStorage,
    {
      get: async () => (await AsyncStorage.getItem(key)) === "1",
      set: () => AsyncStorage.setItem(key, "1"),
    },
  );
}

export function useTodos(user: AuthUser | null = null) {
  const storage = useMemo(() => (user ? accountStorage(user) : asyncTodoStorage), [user]);
  return useSharedTodos(storage);
}
