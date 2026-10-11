import type { MaybePromise, TodoStorage } from "../storage";
import type { Todo } from "../types";

/** Row shape of the `todos` table (see supabase/migrations). */
export type TodoRow = {
  id: string;
  user_id: string;
  data: Todo;
  completed: boolean;
  due_date: string | null;
  updated_at: string;
};

/** Minimal client surface the adapter needs; satisfied by `@supabase/supabase-js` and easy to fake. */
export type TodoTable = {
  list(userId: string): Promise<TodoRow[]>;
  upsert(rows: TodoRow[]): Promise<void>;
  remove(userId: string, ids: string[]): Promise<void>;
  /** Fires whenever any of the user's rows change server-side; returns an unsubscribe. */
  onChange?(userId: string, callback: () => void): () => void;
};

export type CloudConfig = { url: string; anonKey: string };

/** Reads the public Supabase config; `null` means "cloud disabled, stay local-only". */
export function cloudConfig(url: string | undefined, anonKey: string | undefined): CloudConfig | null {
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function toRow(todo: Todo, userId: string): TodoRow {
  return {
    id: todo.id,
    user_id: userId,
    data: todo,
    completed: todo.completed,
    due_date: todo.dueDate ?? null,
    updated_at: todo.updatedAt,
  };
}

export function fromRow(row: TodoRow): Todo {
  return row.data;
}

/**
 * Merge local (signed-out) todos into the account on first sign-in.
 * Remote wins on id collision unless the local copy is newer.
 */
export function mergeLocalIntoAccount(local: readonly Todo[], remote: readonly Todo[]): Todo[] {
  const byId = new Map(remote.map((todo) => [todo.id, todo]));
  for (const todo of local) {
    const existing = byId.get(todo.id);
    if (!existing || existing.updatedAt < todo.updatedAt) byId.set(todo.id, todo);
  }
  return [...byId.values()];
}

/** Last-synced `updatedAt` per todo id, in list order. */
export type CloudVersion = { id: string; updatedAt: string };

export type CloudSavePlan = { changed: Todo[]; removed: string[] };

export function cloudVersions(todos: readonly Todo[]): CloudVersion[] {
  return todos.map((todo) => ({ id: todo.id, updatedAt: todo.updatedAt }));
}

/**
 * What a save must send: todos that are new or whose `updatedAt` differs from
 * the last-synced version (upsert), and known ids no longer in the list (delete).
 */
export function planCloudSave(known: readonly CloudVersion[], todos: readonly Todo[]): CloudSavePlan {
  const versions = new Map(known.map((version) => [version.id, version.updatedAt]));
  const ids = new Set(todos.map((todo) => todo.id));
  return {
    changed: todos.filter((todo) => versions.get(todo.id) !== todo.updatedAt),
    removed: known.map((version) => version.id).filter((id) => !ids.has(id)),
  };
}

/** Realtime channel for the user's todo rows. */
export function realtimeTopic(userId: string): string {
  return `todos:${userId}`;
}

/** Realtime `postgres_changes` subscription for the user's todo rows (RLS also applies to the feed). */
export type TodoChangeFilter = { event: "*"; schema: "public"; table: "todos"; filter: string };

export function todoChangeFilter(userId: string): TodoChangeFilter {
  return { event: "*", schema: "public", table: "todos", filter: `user_id=eq.${userId}` };
}

export type RemoteMerge = { todos: Todo[]; changed: boolean };

/**
 * Folds the account's current rows (`remote`) into this device's list after a
 * change elsewhere. `known` is the last-synced snapshot, which tells a change
 * made on another device apart from a local one that hasn't been saved yet:
 * unsaved local adds, edits and deletes win; everything else follows `remote`.
 * Local order is kept and todos added elsewhere go first, newest first.
 */
export function mergeRemoteTodos(
  local: readonly Todo[],
  remote: readonly Todo[],
  known: readonly CloudVersion[],
): RemoteMerge {
  const versions = new Map(known.map((version) => [version.id, version.updatedAt]));
  const remoteById = new Map(remote.map((todo) => [todo.id, todo]));
  const localIds = new Set(local.map((todo) => todo.id));
  const added = remote
    .filter((todo) => !localIds.has(todo.id) && !versions.has(todo.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const kept: Todo[] = [];
  for (const todo of local) {
    const theirs = remoteById.get(todo.id);
    const synced = versions.get(todo.id);
    if (theirs) kept.push(synced === todo.updatedAt ? theirs : todo);
    else if (synced === undefined) kept.push(todo);
  }
  const todos = [...added, ...kept];
  const changed =
    todos.length !== local.length ||
    todos.some((todo, index) => todo.id !== local[index]!.id || todo.updatedAt !== local[index]!.updatedAt);
  return { todos, changed };
}

/** Per-account flag key recording that the signed-out list was merged in on this device. */
export function migrationKey(userId: string): string {
  return `todo-tracker:migrated:${userId}`;
}

/** Device key holding the signed-in account's cached list and last-synced snapshot. */
export function syncKey(userId: string): string {
  return `todo-tracker:sync:${userId}`;
}

const MERGED_FIELDS = ["title", "notes", "completed", "priority", "dueDate", "createdAt"] as const;

function sameTodo(a: Todo, b: Todo): boolean {
  return a.updatedAt === b.updatedAt && MERGED_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * Merges two edits of the same todo field by field against the last-synced
 * copy (`base`): a field changed on one side only takes that side's value;
 * a field changed on both takes the value from the copy with the newer
 * `updatedAt` (remote on a tie). The result's `updatedAt` is the latest of
 * `now` and both copies, so it sorts after both edits.
 */
export function mergeTodoFields(base: Todo | null, local: Todo, remote: Todo, now: Date): Todo {
  const localNewer = local.updatedAt > remote.updatedAt;
  const merged: Todo = { ...remote };
  for (const field of MERGED_FIELDS) {
    const mine = local[field];
    const theirs = remote[field];
    const value =
      mine === theirs ? theirs
      : base && mine === base[field] ? theirs
      : base && theirs === base[field] ? mine
      : localNewer ? mine
      : theirs;
    if (value === undefined) delete merged[field];
    else Object.assign(merged, { [field]: value });
  }
  merged.updatedAt = [now.toISOString(), local.updatedAt, remote.updatedAt].sort().at(-1)!;
  return merged;
}

export type SyncPlan = { todos: Todo[]; push: Todo[]; remove: string[]; changed: boolean };

/**
 * Reconciles this device's cached list with the account's rows. `base` is the
 * last-synced list, or `null` before the first sync on this device (then the
 * signed-out list is merged in with mergeLocalIntoAccount). Otherwise
 * mergeRemoteTodos applies, todos edited on both sides are merged per field
 * (mergeTodoFields), and deletes on either side win over edits. `push` and
 * `remove` are what the account still needs to match `todos`.
 */
export function planSync(local: readonly Todo[], remote: readonly Todo[], base: readonly Todo[] | null, now: Date): SyncPlan {
  let todos: Todo[];
  if (base === null) {
    todos = mergeLocalIntoAccount(local, remote);
  } else {
    const baseById = new Map(base.map((todo) => [todo.id, todo]));
    const remoteById = new Map(remote.map((todo) => [todo.id, todo]));
    todos = mergeRemoteTodos(local, remote, cloudVersions(base)).todos.map((todo) => {
      const theirs = remoteById.get(todo.id);
      const synced = baseById.get(todo.id);
      if (!theirs || sameTodo(todo, theirs)) return todo;
      const localEdited = todo.updatedAt !== synced?.updatedAt;
      const remoteEdited = theirs.updatedAt !== synced?.updatedAt;
      return localEdited && remoteEdited ? mergeTodoFields(synced ?? null, todo, theirs, now) : todo;
    });
  }
  const { changed: push, removed: remove } = planCloudSave(cloudVersions(remote), todos);
  const changed =
    todos.length !== local.length ||
    todos.some((todo, index) => todo.id !== local[index]!.id || todo.updatedAt !== local[index]!.updatedAt);
  return { todos, push, remove, changed };
}

/** Local changes not yet in the account: adds, edits and deletes since `base`. */
export function pendingChanges(local: readonly Todo[], base: readonly Todo[] | null): number {
  const { changed, removed } = planCloudSave(cloudVersions(base ?? []), local);
  return changed.length + removed.length;
}

/** Text after "Signed in as <email> · " in the account panel. */
export function syncStatus(pending: number): string {
  if (pending === 0) return "syncing across devices";
  return `${pending} ${pending === 1 ? "change" : "changes"} waiting to sync`;
}

export type SyncCache = { todos: Todo[]; base: Todo[] | null };

export type KeyValue = {
  get(key: string): MaybePromise<string | null>;
  set(key: string, value: string): MaybePromise<void>;
};

export type OfflineCloudOptions = {
  table: TodoTable;
  userId: string;
  /** Device storage for the cached list (syncKey(userId)) and the migration flag. */
  store: KeyValue;
  /** The signed-out list, merged into the account on the first sync on this device. */
  signedOut: TodoStorage;
  onOnline?(callback: () => void): () => void;
  now?(): Date;
};

export type OfflineCloudStorage = TodoStorage & {
  /** Reports pendingChanges after every edit and sync. */
  onPending(listener: (pending: number) => void): () => void;
  sync(): Promise<void>;
};

/**
 * Offline-first account storage. Reads and writes go to the device cache, so
 * the list works without a connection; every save, realtime event and
 * reconnect then runs one sync at a time (fetch rows, planSync, push). A
 * failed sync leaves the changes queued in the cache for the next trigger.
 */
export function createOfflineCloudStorage(options: OfflineCloudOptions): OfflineCloudStorage {
  const { table, userId, store, signedOut } = options;
  const now = options.now ?? (() => new Date());
  const key = syncKey(userId);
  let cache: SyncCache | undefined;
  let onRemote: ((todos: Todo[]) => void) | undefined;
  const pendingListeners = new Set<(pending: number) => void>();
  let running: Promise<void> | undefined;
  let again = false;

  const notify = () => {
    const pending = pendingChanges(cache!.todos, cache!.base);
    pendingListeners.forEach((listener) => listener(pending));
  };
  const persist = () => store.set(key, JSON.stringify(cache));
  const read = async (): Promise<SyncCache> => {
    if (cache) return cache;
    const raw = await store.get(key);
    if (raw) cache = JSON.parse(raw) as SyncCache;
    else {
      const migrated = (await store.get(migrationKey(userId))) === "1";
      cache = { todos: migrated ? [] : [...(await signedOut.load())], base: null };
    }
    return cache;
  };

  const syncOnce = async () => {
    const state = await read();
    const remote = (await table.list(userId)).map(fromRow);
    const plan = planSync(state.todos, remote, state.base, now());
    const first = state.base === null;
    if (plan.changed) {
      state.todos = plan.todos;
      onRemote?.(plan.todos);
    }
    await persist();
    if (plan.push.length) await table.upsert(plan.push.map((todo) => toRow(todo, userId)));
    if (plan.remove.length) await table.remove(userId, plan.remove);
    state.base = plan.todos;
    await persist();
    if (first) await store.set(migrationKey(userId), "1");
    notify();
  };

  const sync = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        try {
          await syncOnce();
        } catch {
          // Offline or rejected: the changes stay in the cache until the next trigger.
        }
      } while (again);
      running = undefined;
    })();
    return running;
  };

  return {
    async load() {
      const state = await read();
      notify();
      return state.todos;
    },
    async save(todos) {
      const state = await read();
      if (JSON.stringify(todos) === JSON.stringify(state.todos)) return;
      state.todos = [...todos];
      await persist();
      notify();
      void sync();
    },
    subscribe(onChange) {
      onRemote = onChange;
      const stopRealtime = table.onChange?.(userId, () => void sync());
      const stopOnline = options.onOnline?.(() => void sync());
      void sync();
      return () => {
        onRemote = undefined;
        stopRealtime?.();
        stopOnline?.();
      };
    },
    onPending(listener) {
      pendingListeners.add(listener);
      if (cache) listener(pendingChanges(cache.todos, cache.base));
      return () => pendingListeners.delete(listener);
    },
    sync,
  };
}
