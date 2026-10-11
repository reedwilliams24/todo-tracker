import { useCallback, useEffect, useReducer, useState } from "react";
import { addTodos } from "../list";
import type { TodoStorage } from "../storage";
import { INITIAL_TODO_STATE, reduceTodos, type TodoAction, type TodoState } from "../store";
import type { TodoDraft } from "../types";
import { UNDO_TIMEOUT_MS } from "../undo";

function reducer(state: TodoState, action: TodoAction): TodoState {
  return reduceTodos(state, action);
}

/**
 * Todo list state backed by a platform storage. Loads once on mount and
 * persists every change after hydration. `storage` should be a stable reference.
 */
export function useTodos(storage: TodoStorage) {
  const [{ todos, undoable }, dispatch] = useReducer(reducer, INITIAL_TODO_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!undoable) return;
    const timer = setTimeout(() => dispatch({ type: "expireUndo" }), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [undoable]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(storage.load()).then((loaded) => {
      if (cancelled) return;
      dispatch({ type: "load", todos: loaded });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (hydrated) void storage.save(todos);
  }, [storage, hydrated, todos]);

  const addMany = useCallback((drafts: TodoDraft[]) => {
    const { created } = addTodos([], drafts);
    dispatch({ type: "prepend", todos: created });
    return created;
  }, []);

  const addTodo = useCallback((draft: TodoDraft) => void addMany([draft]), [addMany]);
  const toggle = useCallback((id: string) => dispatch({ type: "toggle", id }), []);
  const rename = useCallback((id: string, title: string) => dispatch({ type: "rename", id, title }), []);
  const remove = useCallback((id: string) => dispatch({ type: "remove", ids: [id] }), []);
  const removeMany = useCallback((ids: string[]) => dispatch({ type: "remove", ids }), []);
  const clearCompleted = useCallback(() => dispatch({ type: "clearCompleted" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);

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
    undoable,
    undo,
  };
}
