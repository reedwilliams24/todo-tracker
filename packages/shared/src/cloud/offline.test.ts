import { describe, expect, it } from "vitest";
import { createTodo } from "../todos";
import type { Todo } from "../types";
import { toRow, type TodoRow, type TodoTable } from "./index";
import { createOfflineFirstStorage, mergeThreeWay, mergeTodo, type KeyValue } from "./offline";

function memoryStore(): KeyValue {
  const map = new Map<string, string>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
}

function fakeTable(seed: TodoRow[] = []) {
  const rows = new Map(seed.map((row) => [row.id, row]));
  let online = true;
  let fire: () => void = () => {};
  const table: TodoTable = {
    async list(userId) {
      if (!online) throw new Error("offline");
      return [...rows.values()].filter((row) => row.user_id === userId);
    },
    async upsert(next) {
      if (!online) throw new Error("offline");
      next.forEach((row) => rows.set(row.id, row));
    },
    async remove(_userId, ids) {
      if (!online) throw new Error("offline");
      ids.forEach((id) => rows.delete(id));
    },
    onChange(_userId, callback) {
      fire = callback;
      return () => {};
    },
  };
  return { table, rows, setOnline: (v: boolean) => (online = v), fire: () => fire() };
}

const at = (todo: Todo, updatedAt: string, patch: Partial<Todo> = {}): Todo => ({
  ...todo,
  ...patch,
  updatedAt,
});

describe("mergeTodo", () => {
  it("resolves per field: untouched side yields, both-touched newest wins", () => {
    const base = at(createTodo({ title: "a" }), "2026-01-01T00:00:00Z", { notes: "n" });
    const local = at(base, "2026-01-02T00:00:00Z", { title: "local title" });
    const remote = at(base, "2026-01-03T00:00:00Z", { completed: true, notes: "remote notes" });
    const merged = mergeTodo(base, local, remote);
    expect(merged.title).toBe("local title");
    expect(merged.completed).toBe(true);
    expect(merged.notes).toBe("remote notes");
    expect(merged.updatedAt).toBe("2026-01-03T00:00:00Z");
  });

  it("same field edited on both sides: newer updatedAt wins", () => {
    const base = at(createTodo({ title: "a" }), "2026-01-01T00:00:00Z");
    const local = at(base, "2026-01-05T00:00:00Z", { title: "L" });
    const remote = at(base, "2026-01-03T00:00:00Z", { title: "R" });
    expect(mergeTodo(base, local, remote).title).toBe("L");
    expect(mergeTodo(base, remote, local).title).toBe("L");
  });
});

describe("mergeThreeWay", () => {
  it("deletes win over concurrent edits on either side", () => {
    const a = createTodo({ title: "a" });
    const b = createTodo({ title: "b" });
    const editedA = at(a, "2099-01-01T00:00:00Z", { title: "edited" });
    const result = mergeThreeWay(
      { base: [a, b], local: [editedA], deleted: [b.id] }, // deleted b locally, edited a
      [at(b, "2099-01-01T00:00:00Z", { title: "b edited remotely" })], // a deleted remotely
    );
    expect(result.todos).toEqual([]);
    expect(result.remove).toEqual([b.id]);
    expect(result.push).toEqual([]);
  });

  it("new items on both sides are kept; only local ones are pushed", () => {
    const l = createTodo({ title: "l" });
    const r = createTodo({ title: "r" });
    const result = mergeThreeWay({ base: [], local: [l], deleted: [] }, [r]);
    expect(result.todos.map((t) => t.id).sort()).toEqual([l.id, r.id].sort());
    expect(result.push).toEqual([l]);
  });
});

describe("createOfflineFirstStorage", () => {
  it("queues edits while offline and pushes them when back online", async () => {
    const { table, rows, setOnline } = fakeTable();
    const storage = createOfflineFirstStorage({ table, userId: "u1", store: memoryStore() });
    expect(await storage.load()).toEqual([]);

    setOnline(false);
    const todo = createTodo({ title: "offline" });
    await storage.save([todo]);
    await new Promise((r) => setTimeout(r, 0));
    expect(rows.size).toBe(0);
    expect(await storage.load()).toEqual([todo]); // still readable locally

    setOnline(true);
    const seen: Todo[][] = [];
    storage.subscribe!((t) => seen.push(t));
    await new Promise((r) => setTimeout(r, 0));
    expect(rows.size).toBe(1);
    expect(rows.get(todo.id)?.data.title).toBe("offline");
  });

  it("seeds from the signed-out list on first sync and pulls remote changes", async () => {
    const remote = createTodo({ title: "remote" });
    const local = createTodo({ title: "local" });
    const { table, rows, fire } = fakeTable([toRow(remote, "u1")]);
    const storage = createOfflineFirstStorage({
      table,
      userId: "u1",
      store: memoryStore(),
      seed: { load: () => [local], save: () => {} },
    });
    expect(await storage.load()).toEqual([local]);

    const updates: Todo[][] = [];
    storage.subscribe!((t) => updates.push(t));
    await new Promise((r) => setTimeout(r, 0));
    expect(rows.size).toBe(2);
    expect(updates.at(-1)?.map((t) => t.title).sort()).toEqual(["local", "remote"]);

    const phone = createTodo({ title: "phone" });
    rows.set(phone.id, toRow(phone, "u1"));
    fire();
    await new Promise((r) => setTimeout(r, 0));
    expect(updates.at(-1)?.map((t) => t.title).sort()).toEqual(["local", "phone", "remote"]);
  });
});
