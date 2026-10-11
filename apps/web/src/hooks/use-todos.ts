"use client";

import { useEffect, useMemo, useState } from "react";
import { useTodos as useSharedTodos } from "@/domain/react";
import { createOfflineCloudStorage, type OfflineCloudStorage, type TodoStorage } from "@/domain";
import { localTodoStorage } from "@/lib/storage";
import { supabase, todoTable } from "@/lib/supabase";
import type { AuthUser } from "@/hooks/use-auth";

function accountStorage(user: AuthUser): OfflineCloudStorage | null {
  if (!supabase) return null;
  return createOfflineCloudStorage({
    table: todoTable(supabase),
    userId: user.id,
    store: {
      get: (key) => window.localStorage.getItem(key),
      set: (key, value) => window.localStorage.setItem(key, value),
    },
    signedOut: localTodoStorage,
    onOnline(callback) {
      window.addEventListener("online", callback);
      return () => window.removeEventListener("online", callback);
    },
  });
}

export function useTodos(user: AuthUser | null = null) {
  const account = useMemo(() => (user ? accountStorage(user) : null), [user]);
  const storage: TodoStorage = account ?? localTodoStorage;
  const [pending, setPending] = useState(0);
  useEffect(() => {
    setPending(0);
    return account?.onPending(setPending);
  }, [account]);
  return { ...useSharedTodos(storage), pending };
}
