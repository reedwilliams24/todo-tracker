"use client";

import { useMemo } from "react";
import { useTodos as useSharedTodos } from "@todo/shared/react";
import { createOfflineFirstStorage, type TodoStorage } from "@todo/shared";
import { localTodoStorage } from "@/lib/storage";
import { supabase, todoTable } from "@/lib/supabase";
import type { AuthUser } from "@/hooks/use-auth";

function accountStorage(user: AuthUser): TodoStorage {
  if (!supabase) return localTodoStorage;
  return createOfflineFirstStorage({
    table: todoTable(supabase),
    userId: user.id,
    store: {
      get: (key) => window.localStorage.getItem(key),
      set: (key, value) => window.localStorage.setItem(key, value),
    },
    seed: localTodoStorage,
    onOnline: (callback) => {
      window.addEventListener("online", callback);
      return () => window.removeEventListener("online", callback);
    },
  });
}

export function useTodos(user: AuthUser | null = null) {
  const storage = useMemo(() => (user ? accountStorage(user) : localTodoStorage), [user]);
  return useSharedTodos(storage);
}
