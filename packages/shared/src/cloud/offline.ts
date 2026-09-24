import type { MaybePromise, TodoStorage } from "../storage";
import type { Todo } from "../types";
import { fromRow, toRow, type TodoTable } from "./index";

/** Minimal string key/value store (localStorage on web, AsyncStorage on mobile). */
export type KeyValue = {
  get(key: string): MaybePromise<string | null>;
  set(key: string, value: string): MaybePromise<void>;
};

/** Persisted sync state: `base` is the last server state we reconciled against. */
export type SyncState = {
  base: Todo[];
  local: Todo[];
  deleted: string[];
};

export type MergeResult = {
  todos: Todo[];
  push: Todo[];
  remove: string[];
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Per-field last-writer-wins for a todo edited on both sides since `base`. */
export function mergeTodo(base: Todo | undefined, local: Todo, remote: Todo): Todo {
  if (same(local, remote) || same(local, base)) return remote;
  if (same(remote, base)) return local;
  const newer = local.updatedAt >= remote.updatedAt ? local : remote;
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]) as Set<keyof Todo>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const l = local[key];
    const r = remote[key];
    const b = base?.[key];
    out[key] = same(l, b) ? r : same(r, b) ? l : newer[key];
  }
  out.updatedAt = local.updatedAt >= remote.updatedAt ? local.updatedAt : remote.updatedAt;
  return out as Todo;
}

/**
 * Three-way merge of the local list against the server. Deletes win on either side;
 * concurrent edits resolve per field, newest `updatedAt` breaking ties.
 */
export function mergeThreeWay(state: SyncState, remote: readonly Todo[]): MergeResult {
  const base = new Map(state.base.map((t) => [t.id, t]));
  const local = new Map(state.local.map((t) => [t.id, t]));
  const server = new Map(remote.map((t) => [t.id, t]));
  const tombstones = new Set(state.deleted);
  const todos: Todo[] = [];
  const push: Todo[] = [];
  const remove: string[] = [];

  for (const id of new Set([...local.keys(), ...server.keys()])) {
    const l = local.get(id);
    const r = server.get(id);
    if (tombstones.has(id)) {
      if (r) remove.push(id);
      continue;
    }
    if (!r) {
      if (base.has(id)) continue; // deleted on another device
      todos.push(l!);
      push.push(l!);
      continue;
    }
    if (!l) {
      todos.push(r);
      continue;
    }
    const merged = mergeTodo(base.get(id), l, r);
    todos.push(merged);
    if (!same(merged, r)) push.push(merged);
  }
  return { todos, push, remove };
}

export type OfflineFirstOptions = {
  table: TodoTable;
  userId: string;
  store: KeyValue;
  /** Signed-out list to fold into the account the first time this device syncs. */
  seed?: TodoStorage;
  /** Platform hook for connectivity regained (e.g. window "online"); returns cleanup. */
  onOnline?(callback: () => void): () => void;
};

/**
 * Offline-first account storage: reads and writes hit the device cache immediately;
 * changes are pushed to the server when reachable and pulled on realtime events,
 * reconnect, and subscribe. Sync failures leave pending changes queued.
 */
export function createOfflineFirstStorage(options: OfflineFirstOptions): TodoStorage {
  const { table, userId, store, seed, onOnline } = options;
  const key = `todo-tracker:sync:${userId}`;
  let state: SyncState | null = null;
  let listener: ((todos: Todo[]) => void) | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  async function read(): Promise<SyncState> {
    if (state) return state;
    const raw = await store.get(key);
    if (raw) {
      state = JSON.parse(raw) as SyncState;
    } else {
      const local = seed ? [...(await seed.load())] : [];
      state = { base: [], local, deleted: [] };
    }
    return state;
  }

  async function write(next: SyncState) {
    state = next;
    await store.set(key, JSON.stringify(next));
  }

  async function syncOnce() {
    const current = await read();
    const remote = (await table.list(userId)).map(fromRow);
    const { todos, push, remove } = mergeThreeWay(current, remote);
    if (push.length) await table.upsert(push.map((t) => toRow(t, userId)));
    if (remove.length) await table.remove(userId, remove);
    const changed = !same(todos, current.local);
    await write({ base: todos, local: todos, deleted: [] });
    if (changed) listener?.(todos);
  }

  /** Serialized; a failed sync (offline) is swallowed and retried on the next trigger. */
  function sync() {
    inFlight = inFlight.then(syncOnce).catch(() => {});
    return inFlight;
  }

  return {
    async load() {
      return (await read()).local;
    },
    async save(todos) {
      const current = await read();
      const kept = new Set(todos.map((t) => t.id));
      const gone = [...current.base, ...current.local]
        .map((t) => t.id)
        .filter((id) => !kept.has(id));
      await write({
        base: current.base,
        local: [...todos],
        deleted: [...new Set([...current.deleted, ...gone])],
      });
      void sync();
    },
    subscribe(onChange) {
      listener = onChange;
      void sync();
      const stopRemote = table.onChange?.(userId, () => void sync()) ?? (() => {});
      const stopOnline = onOnline?.(() => void sync()) ?? (() => {});
      return () => {
        listener = null;
        stopRemote();
        stopOnline();
      };
    },
  };
}
