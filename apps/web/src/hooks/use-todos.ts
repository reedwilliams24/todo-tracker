"use client";

import { useEffect, useRef, useState } from "react";
import type { Todo, TodoStorage } from "@/domain";
import { useTodos as useSharedTodos } from "@/domain/react";
import { syncCursorStorage } from "@/lib/account";
import { localTodoStorage } from "@/lib/storage";
import { SyncEngine, type SyncServer } from "@/lib/sync-engine";

/** Signed in: the server and user the list syncs with. Should be a stable reference. */
export type SyncSetup = { server: SyncServer; userId: string };

const PUSH_FAILED_MS = 5000;

/** The todo list; with `sync`, every edit is pushed and the list pulls on mount and when the tab comes back. */
export function useTodos(storage: TodoStorage = localTodoStorage, sync?: SyncSetup | null) {
  const shared = useSharedTodos(storage);
  const { todos, hydrated, replace } = shared;
  const latest = useRef(todos);
  const previous = useRef(todos);
  const replaced = useRef<Todo[] | null>(null);
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [pushFailed, setPushFailed] = useState(false);
  latest.current = todos;

  useEffect(() => {
    if (!sync || !hydrated) return;
    const next = new SyncEngine(
      sync.server,
      sync.userId,
      syncCursorStorage,
      {
        current: () => latest.current,
        replace: (list) => {
          latest.current = list;
          replaced.current = list;
          replace(list);
        },
      },
      () => setPushFailed(true),
    );
    previous.current = latest.current;
    setEngine(next);
    const pull = () => void next.pull().catch(() => undefined);
    const onVisibility = () => {
      if (document.visibilityState === "visible") pull();
    };
    pull();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      next.close();
      setEngine(null);
    };
  }, [sync, hydrated, replace]);

  useEffect(() => {
    const before = previous.current;
    previous.current = todos;
    if (!engine || before === todos || todos === replaced.current) return;
    void engine.edit(before, todos);
  }, [engine, todos]);

  useEffect(() => {
    if (!pushFailed) return;
    const timer = setTimeout(() => setPushFailed(false), PUSH_FAILED_MS);
    return () => clearTimeout(timer);
  }, [pushFailed]);

  return { ...shared, pushFailed };
}
