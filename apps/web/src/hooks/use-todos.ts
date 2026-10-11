"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Todo, TodoStorage } from "@/domain";
import { useTodos as useSharedTodos } from "@/domain/react";
import { syncCursorStorage } from "@/lib/account";
import type { ConnectionState, RealtimeConnection } from "@/lib/realtime";
import { localTodoStorage } from "@/lib/storage";
import { SyncEngine, type SyncServer } from "@/lib/sync-engine";

/** Signed in: the server and user the list syncs with, and the live connection. Should be a stable reference. */
export type SyncSetup = { server: SyncServer; userId: string; realtime?: RealtimeConnection | null };

const PUSH_FAILED_MS = 5000;

/**
 * The todo list. With `sync`, every edit is pushed. With `sync.realtime`, the tab is live while visible: it connects (and
 * pulls) when shown and disconnects when hidden. Without it, the list pulls on mount and when the tab comes back.
 */
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
    const { realtime } = sync;
    const target = {
      userId: sync.userId,
      pull: () => next.pull(),
      applyRemote: (rows: Parameters<SyncEngine["applyRemote"]>[0]) => next.applyRemote(rows),
    };
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      if (realtime) realtime.connect(target);
      else void next.pull().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") realtime?.disconnect();
      else resume();
    };
    if (realtime) resume();
    else void next.pull().catch(() => undefined);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", resume);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", resume);
      realtime?.disconnect();
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

  const connection = useConnectionState(sync?.realtime ?? null);
  return { ...shared, pushFailed, connection };
}

/** The live connection's state, or null when the list isn't synced live (guest, or no Supabase config). */
function useConnectionState(realtime: RealtimeConnection | null): ConnectionState | null {
  const subscribe = useCallback(
    (listener: () => void) => realtime?.subscribe(listener) ?? (() => undefined),
    [realtime],
  );
  return useSyncExternalStore(
    subscribe,
    () => realtime?.current ?? null,
    () => null,
  );
}
