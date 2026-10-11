"use client";

import type { TodoStorage } from "@/domain";
import { useTodos as useSharedTodos } from "@/domain/react";
import { localTodoStorage } from "@/lib/storage";

export function useTodos(storage: TodoStorage = localTodoStorage) {
  return useSharedTodos(storage);
}
