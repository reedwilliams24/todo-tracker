"use client";

import { useTodos as useSharedTodos } from "@/domain/react";
import { localTodoStorage } from "@/lib/storage";

export function useTodos() {
  return useSharedTodos(localTodoStorage);
}
