import { useCallback, useEffect, useState } from "react";
import { addTodos, clearCompletedInList, removeFromList, renameInList, toggleInList } from "../list";
import type { TodoStorage } from "../storage";
import type { Todo, TodoDraft } from "../types";
import { createUndoEntry, describeUndo, isUndoExpired, UNDO_TIMEOUT_MS, type UndoEntry } from "../undo";

/**
 * Todo list state backed by a platform storage. Loads once on mount and
 * persists every change after hydration. `storage` should be a stable reference.
 */
export function useTodos(storage: TodoStorage) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [undoable, setUndoable] = useState<UndoEntry | null>(null);

  useEffect(() => {
    if (!undoable) return;
    const timer = setTimeout(() => {
      setUndoable((current) => (current && isUndoExpired(current) ? null : current));
    }, UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [undoable]);

  /** Applies `fn` and remembers the previous list so it can be undone for a few seconds. */
  const applyUndoable = useCallback((label: string, fn: (current: Todo[]) => Todo[]) => {
    setTodos((current) => {
      const next = fn(current);
      if (next !== current) setUndoable(createUndoEntry(label, current));
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setUndoable((entry) => {
      if (entry) setTodos([...entry.before]);
      return null;
    });
  }, []);

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

  const toggle = useCallback(
    (id: string) => {
      setTodos((current) => {
        const target = current.find((todo) => todo.id === id);
        if (target && !target.completed) setUndoable(createUndoEntry(describeUndo("complete", 1), current));
        return toggleInList(current, id);
      });
    },
    [],
  );

  const rename = useCallback((id: string, title: string) => {
    setTodos((current) => renameInList(current, id, title));
  }, []);

  const remove = useCallback(
    (id: string) => applyUndoable(describeUndo("delete", 1), (current) => removeFromList(current, [id])),
    [applyUndoable],
  );

  const removeMany = useCallback(
    (ids: string[]) =>
      applyUndoable(describeUndo("delete", ids.length), (current) => removeFromList(current, ids)),
    [applyUndoable],
  );

  const clearCompleted = useCallback(() => {
    setTodos((current) => {
      const next = clearCompletedInList(current);
      const removed = current.length - next.length;
      if (removed > 0) setUndoable(createUndoEntry(describeUndo("delete", removed), current));
      return next;
    });
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
    undoable,
    undo,
  };
}
