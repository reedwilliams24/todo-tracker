"use client";

import { useTodos as useSharedTodos } from "@todo/shared/react";
import { localTodoStorage } from "@/lib/storage";

export function useTodos() {
  return useSharedTodos(localTodoStorage);
}
