import { useTodos as useSharedTodos } from "@todo/shared/react";
import { asyncTodoStorage } from "../lib/storage";

export function useTodos() {
  return useSharedTodos(asyncTodoStorage);
}
