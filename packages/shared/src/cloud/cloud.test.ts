import { describe, expect, it } from "vitest";
import { createTodo } from "../todos";
import {
  cloudConfig,
  createCloudTodoStorage,
  mergeLocalIntoAccount,
  toRow,
  withFirstSignInMigration,
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

  it("loads only the user's rows and round-trips the todo", async () => {
    const mine = createTodo({ title: "mine" }, now);
    const theirs = createTodo({ title: "theirs" }, now);
    const { table } = fakeTable([toRow(mine, "u1"), toRow(theirs, "u2")]);
    const storage = createCloudTodoStorage(table, "u1");
    expect(await storage.load()).toEqual([mine]);
  });

  it("save upserts only changed todos and deletes missing ones", async () => {
    const a = createTodo({ title: "a" }, now);
    const b = createTodo({ title: "b" }, now);
    const { table, rows, calls } = fakeTable([toRow(a, "u1"), toRow(b, "u1")]);
    const storage = createCloudTodoStorage(table, "u1");
    await storage.load();

    const aDone = { ...a, completed: true, updatedAt: new Date(2026, 8, 25).toISOString() };
    await storage.save([aDone]);

    expect(calls).toEqual(["list", "upsert:1", "remove:1"]);
    expect([...rows.keys()]).toEqual([a.id]);
    expect(rows.get(a.id)?.completed).toBe(true);

    await storage.save([aDone]);
    expect(calls).toHaveLength(3);
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

describe("withFirstSignInMigration", () => {
  it("merges local todos into the account once", async () => {
    const local = createTodo({ title: "local" }, now);
    const remote = createTodo({ title: "remote" }, now);
    const { table, rows } = fakeTable([toRow(remote, "u1")]);
    let migrated = false;
    const storage = withFirstSignInMigration(
      createCloudTodoStorage(table, "u1"),
      { load: () => [local], save: () => undefined },
      { get: () => migrated, set: () => void (migrated = true) },
    );
    const first = await storage.load();
    expect(first.map((todo) => todo.title).sort()).toEqual(["local", "remote"]);
    expect(rows.size).toBe(2);
    rows.delete(local.id);
    expect((await storage.load()).map((todo) => todo.title)).toEqual(["remote"]);
  });
});

describe("cloud subscribe", () => {
  it("reloads from the table when another device changes a row", async () => {
    const remote = createTodo({ title: "remote" });
    const { table, rows } = fakeTable([toRow(remote, "u1")]);
    let fire: () => void = () => {};
    table.onChange = (_userId, callback) => {
      fire = callback;
      return () => {};
    };
    const storage = createCloudTodoStorage(table, "u1");
    await storage.load();

    const added = createTodo({ title: "from phone" });
    rows.set(added.id, toRow(added, "u1"));
    const seen = new Promise<string[]>((resolve) =>
      storage.subscribe!((todos) => resolve(todos.map((t) => t.title).sort())),
    );
    fire();
    expect(await seen).toEqual(["from phone", "remote"]);

    // Reload updated `known`, so a follow-up save is a no-op.
    await storage.save([remote, added]);
    expect(rows.size).toBe(2);
  });
});
