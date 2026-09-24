"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createTodo,
  toggleTodo as toggleTodoItem,
  updateTodo,
  type Todo,
  type TodoDraft,
} from "@todo/shared";
import { loadTodos, saveTodos } from "@/lib/storage";

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTodos(loadTodos());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveTodos(todos);
  }, [hydrated, todos]);

  const addTodo = useCallback((draft: TodoDraft) => {
    setTodos((current) => [createTodo(draft), ...current]);
  }, []);

  const toggle = useCallback((id: string) => {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? toggleTodoItem(todo) : todo)),
    );
  }, []);

  const rename = useCallback((id: string, title: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? updateTodo(todo, { title: title.trim() }) : todo,
      ),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTodos((current) => current.filter((todo) => !todo.completed));
  }, []);

  return { todos, hydrated, addTodo, toggle, rename, remove, clearCompleted };
}
