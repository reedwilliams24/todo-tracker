import { useCallback, useEffect, useState } from "react";
import {
  addTodos,
  clearCompletedInList,
  removeFromList,
  renameInList,
  toggleInList,
  updateInList,
} from "../list";
import { addSubtask, removeSubtask, toggleSubtask } from "../subtasks";
import type { TodoStorage } from "../storage";
import type { Todo, TodoDraft } from "../types";

/**
 * Todo list state backed by a platform storage. Loads once on mount and
 * persists every change after hydration. `storage` should be a stable reference.
 */
export function useTodos(storage: TodoStorage) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(storage.load()).then((loaded) => {
      if (cancelled) return;
      setTodos(loaded);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (hydrated) void storage.save(todos);
  }, [storage, hydrated, todos]);

  const addTodo = useCallback((draft: TodoDraft) => {
    setTodos((current) => addTodos(current, [draft]).todos);
  }, []);

  const addMany = useCallback((drafts: TodoDraft[]) => {
    const { created } = addTodos([], drafts);
    setTodos((current) => [...created, ...current]);
    return created;
  }, []);

  const toggle = useCallback((id: string) => {
    setTodos((current) => toggleInList(current, id));
  }, []);

  const rename = useCallback((id: string, title: string) => {
    setTodos((current) => renameInList(current, id, title));
  }, []);

  const remove = useCallback((id: string) => {
    setTodos((current) => removeFromList(current, [id]));
  }, []);

  const removeMany = useCallback((ids: string[]) => {
    setTodos((current) => removeFromList(current, ids));
  }, []);

  const addSubtaskTo = useCallback((id: string, title: string) => {
    setTodos((current) => updateInList(current, id, (todo) => addSubtask(todo, title)));
  }, []);

  const toggleSubtaskOf = useCallback((id: string, subtaskId: string) => {
    setTodos((current) => updateInList(current, id, (todo) => toggleSubtask(todo, subtaskId)));
  }, []);

  const removeSubtaskOf = useCallback((id: string, subtaskId: string) => {
    setTodos((current) => updateInList(current, id, (todo) => removeSubtask(todo, subtaskId)));
  }, []);

  const clearCompleted = useCallback(() => {
    setTodos(clearCompletedInList);
  }, []);

  return {
    todos,
    hydrated,
    addTodo,
    addMany,
    toggle,
    rename,
    remove,
    removeMany,
    clearCompleted,
    addSubtask: addSubtaskTo,
    toggleSubtask: toggleSubtaskOf,
    removeSubtask: removeSubtaskOf,
  };
}
