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

/**
 * TodoStorage backed by a per-user table. `save` diffs against the last
 * loaded/saved snapshot so deletes propagate without a full table rewrite.
 * Saves and remote reloads run one at a time so `known` never goes backwards.
 */
export function createCloudTodoStorage(table: TodoTable, userId: string): TodoStorage {
  let known: CloudVersion[] = [];
  let latest: readonly Todo[] = [];
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task).catch(() => {});
    return queue;
  };

  return {
    async load() {
      const todos = (await table.list(userId)).map(fromRow);
      known = cloudVersions(todos);
      latest = todos;
      return todos;
    },
    save(todos) {
      latest = todos;
      return enqueue(async () => {
        const { changed, removed } = planCloudSave(known, todos);
        if (changed.length) await table.upsert(changed.map((todo) => toRow(todo, userId)));
        if (removed.length) await table.remove(userId, removed);
        known = cloudVersions(todos);
      });
    },
    subscribe(onChange) {
      if (!table.onChange) return () => {};
      let pending = false;
      return table.onChange(userId, () => {
        // One reload covers a burst of row events (a save touching many rows).
        if (pending) return;
        pending = true;
        void enqueue(async () => {
          pending = false;
          const remote = (await table.list(userId)).map(fromRow);
          const merged = mergeRemoteTodos(latest, remote, known);
          known = cloudVersions(remote);
          if (!merged.changed) return;
          latest = merged.todos;
          onChange(merged.todos);
        });
      });
    },
  };
}

export type MigrationFlag = {
  get(): MaybePromise<boolean>;
  set(): MaybePromise<void>;
};

/**
 * Wraps account storage so the first load for this account folds the
 * signed-out local todos in (see mergeLocalIntoAccount) exactly once.
 */
export function withFirstSignInMigration(
  cloud: TodoStorage,
  local: TodoStorage,
  flag: MigrationFlag,
): TodoStorage {
  return {
    async load() {
      const remote = await cloud.load();
      if (await flag.get()) return remote;
      const merged = mergeLocalIntoAccount(await local.load(), remote);
      await cloud.save(merged);
      await flag.set();
      return merged;
    },
    save: (todos) => cloud.save(todos),
    subscribe: cloud.subscribe?.bind(cloud),
  };
}
