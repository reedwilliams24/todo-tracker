import { describe, expect, it } from "vitest";
import { createTodo } from "../todos";
import {
  cloudConfig,
  createOfflineCloudStorage,
  fromRow,
  mergeLocalIntoAccount,
  migrationKey,
  syncKey,
  toRow,
  type TodoRow,
  type TodoTable,
} from "./index";

function fakeTable(seed: TodoRow[] = []) {
  const rows = new Map(seed.map((row) => [row.id, row]));
  const calls: string[] = [];
  const table: TodoTable = {
    async list(userId) {
      calls.push("list");
      return [...rows.values()].filter((row) => row.user_id === userId);
    },
    async upsert(next) {
      calls.push(`upsert:${next.length}`);
      next.forEach((row) => rows.set(row.id, row));
    },
    async remove(_userId, ids) {
      calls.push(`remove:${ids.length}`);
      ids.forEach((id) => rows.delete(id));
    },
  };
  return { table, rows, calls };
}

const now = new Date(2026, 8, 24);

describe("cloud storage", () => {
  it("cloudConfig is null unless both values are set", () => {
    expect(cloudConfig(undefined, "k")).toBeNull();
    expect(cloudConfig("u", "")).toBeNull();
    expect(cloudConfig("u", "k")).toEqual({ url: "u", anonKey: "k" });
  });

  it("mergeLocalIntoAccount keeps the newer copy on collision", () => {
    const shared = createTodo({ title: "shared" }, now);
    const localNewer = { ...shared, title: "edited", updatedAt: new Date(2026, 8, 26).toISOString() };
    const localOnly = createTodo({ title: "local" }, now);
    const remoteOnly = createTodo({ title: "remote" }, now);
    const merged = mergeLocalIntoAccount([localNewer, localOnly], [shared, remoteOnly]);
    expect(merged.map((todo) => todo.title).sort()).toEqual(["edited", "local", "remote"]);
  });
});

function memoryStore() {
  const values = new Map<string, string>();
  return { values, get: (key: string) => values.get(key) ?? null, set: (key: string, value: string) => void values.set(key, value) };
}

function setup(seed: TodoRow[] = [], signedOut: ReturnType<typeof createTodo>[] = []) {
  const fake = fakeTable(seed);
  const store = memoryStore();
  let online = true;
  let reconnect: () => void = () => {};
  let fire: () => void = () => {};
  const list = fake.table.list;
  fake.table.list = (userId) => (online ? list(userId) : Promise.reject(new Error("offline")));
  fake.table.onChange = (_userId, callback) => {
    fire = callback;
    return () => {};
  };
  const storage = createOfflineCloudStorage({
    table: fake.table,
    userId: "u1",
    store,
    signedOut: { load: () => signedOut, save: () => undefined },
    onOnline: (callback) => {
      reconnect = callback;
      return () => {};
    },
    now: () => new Date(2026, 8, 30),
  });
  const pending: number[] = [];
  storage.onPending((count) => pending.push(count));
  return {
    ...fake,
    store,
    storage,
    pending,
    goOffline: () => void (online = false),
    goOnline: () => {
      online = true;
      reconnect();
    },
    fire: () => fire(),
  };
}

const later = (days: number) => new Date(2026, 8, 24 + days).toISOString();

describe("offline-first account storage", () => {
  it("merges the signed-out list into the account on the first sync, once", async () => {
    const local = createTodo({ title: "local" }, now);
    const remote = createTodo({ title: "remote" }, now);
    const { storage, rows, store } = setup([toRow(remote, "u1"), toRow(createTodo({ title: "theirs" }, now), "u2")], [local]);
    expect((await storage.load()).map((todo) => todo.title)).toEqual(["local"]);
    const seen: string[][] = [];
    storage.subscribe!((todos) => seen.push(todos.map((todo) => todo.title)));
    await storage.sync();
    expect(seen).toEqual([["remote", "local"]]);
    expect([...rows.values()].filter((row) => row.user_id === "u1")).toHaveLength(2);
    expect(store.values.get(migrationKey("u1"))).toBe("1");
    expect(JSON.parse(store.values.get(syncKey("u1"))!).base).toHaveLength(2);
  });

  it("queues edits made offline in the device cache and pushes them on reconnect", async () => {
    const a = createTodo({ title: "a" }, now);
    const b = createTodo({ title: "b" }, now);
    const { storage, rows, pending, goOffline, goOnline, store } = setup([toRow(a, "u1"), toRow(b, "u1")]);
    await storage.load();
    storage.subscribe!(() => {});
    await storage.sync();

    goOffline();
    const added = createTodo({ title: "offline add" }, new Date(2026, 8, 26));
    await storage.save([added, { ...a, completed: true, updatedAt: later(2) }]);
    await storage.sync();
    expect(pending.at(-1)).toBe(3);
    expect(rows.has(added.id)).toBe(false);
    expect(JSON.parse(store.values.get(syncKey("u1"))!).todos).toHaveLength(2);

    goOnline();
    await storage.sync();
    expect(pending.at(-1)).toBe(0);
    expect([...rows.values()].map((row) => fromRow(row).title).sort()).toEqual(["a", "offline add"]);
    expect(rows.get(a.id)?.completed).toBe(true);
  });

  it("merges edits to different fields of the same todo from both sides", async () => {
    const a = createTodo({ title: "a" }, now);
    const { storage, rows, fire } = setup([toRow(a, "u1")]);
    await storage.load();
    let latest: string[] = [];
    storage.subscribe!((todos) => (latest = todos.map((todo) => `${todo.title}:${todo.completed}`)));
    await storage.sync();
    rows.set(a.id, toRow({ ...a, title: "renamed on phone", updatedAt: later(1) }, "u1"));
    await storage.save([{ ...a, completed: true, updatedAt: later(2) }]);
    fire();
    await storage.sync();
    expect(latest).toEqual(["renamed on phone:true"]);
    expect(fromRow(rows.get(a.id)!)).toMatchObject({ title: "renamed on phone", completed: true });
  });

  it("lets a delete win over an edit made on another device", async () => {
    const a = createTodo({ title: "a" }, now);
    const { storage, rows, goOffline, goOnline } = setup([toRow(a, "u1")]);
    await storage.load();
    storage.subscribe!(() => {});
    await storage.sync();
    goOffline();
    await storage.save([]);
    rows.set(a.id, toRow({ ...a, title: "edited elsewhere", updatedAt: later(1) }, "u1"));
    goOnline();
    await storage.sync();
    expect(rows.size).toBe(0);
  });

  it("stays quiet for the echo of this device's own save", async () => {
    const { storage, fire, calls } = setup();
    await storage.load();
    const pushed: string[][] = [];
    storage.subscribe!((todos) => pushed.push(todos.map((todo) => todo.title)));
    await storage.save([createTodo({ title: "mine" }, now)]);
    await storage.sync();
    fire();
    await storage.sync();
    expect(pushed).toEqual([]);
    expect(calls.filter((call) => call.startsWith("upsert"))).toEqual(["upsert:1"]);
  });
});
