"use client";

import { useMemo } from "react";
import { useTodos as useSharedTodos } from "@todo/shared/react";
import {
  createCloudTodoStorage,
  withFirstSignInMigration,
  type TodoStorage,
} from "@todo/shared";
import { localTodoStorage } from "@/lib/storage";
import { supabase, todoTable } from "@/lib/supabase";
import type { AuthUser } from "@/hooks/use-auth";

function accountStorage(user: AuthUser): TodoStorage {
  if (!supabase) return localTodoStorage;
  const key = `todo-tracker:migrated:${user.id}`;
  return withFirstSignInMigration(
    createCloudTodoStorage(todoTable(supabase), user.id),
    localTodoStorage,
    {
      get: () => window.localStorage.getItem(key) === "1",
      set: () => window.localStorage.setItem(key, "1"),
    },
  );
}

export function useTodos(user: AuthUser | null = null) {
  const storage = useMemo(() => (user ? accountStorage(user) : localTodoStorage), [user]);
  return useSharedTodos(storage);
}
