import { describe, expect, it } from "vitest";
import type { Todo, TodoRow } from "../domain";
import { PULL_PAGE_SIZE, SyncEngine, type SyncServer } from "./sync-engine";

const USER = "user-1";
const T0 = "2026-01-05T09:00:00.000Z";
const T1 = "2026-01-05T10:00:00.000Z";
const NOW = new Date("2026-01-06T12:00:00.000Z");

const todo = (id: string, overrides: Partial<Todo> = {}): Todo => ({
  id,
  title: `Todo ${id}`,
  completed: false,
  priority: "medium",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

/** In-memory `todos` table: LWW on updated_at, tombstones win, server_seq per write. */
class FakeServer implements SyncServer {
  rows = new Map<string, TodoRow>();
  seq = 0;
  failPush = false;
  pushes: TodoRow[][] = [];
  pulls: number[] = [];

  async push(rows: TodoRow[]) {
    this.pushes.push(rows);
    if (this.failPush) throw new Error("offline");
    for (const row of rows) {
      const stored = this.rows.get(row.id);
      if (stored && (stored.deleted_at !== null || (row.deleted_at === null && stored.updated_at > row.updated_at)))
        continue;
      this.rows.set(row.id, { ...row, user_id: USER, server_seq: ++this.seq });
    }
    return rows.map((row) => this.rows.get(row.id)!);
  }

  async pull(cursor: number, limit: number) {
    this.pulls.push(cursor);
    return [...this.rows.values()]
      .filter((row) => row.server_seq! > cursor)
      .sort((a, b) => a.server_seq! - b.server_seq!)
      .slice(0, limit);
  }

  write(row: Partial<TodoRow> & { id: string }) {
    const full: TodoRow = {
      user_id: USER,
      title: `Todo ${row.id}`,
      notes: null,
      completed: false,
      priority: "medium",
      due_date: null,
      recurrence: null,
      completed_at: null,
      created_at: T0,
      updated_at: T1,
      deleted_at: null,
      server_seq: ++this.seq,
      ...row,
    };
    this.rows.set(row.id, full);
  }
}

function setup(initial: Todo[] = []) {
  const server = new FakeServer();
  const state = { todos: initial, cursor: 0, failures: 0 };
  const engine = new SyncEngine(
    server,
    USER,
    { load: () => state.cursor, save: (cursor) => void (state.cursor = cursor) },
    { current: () => state.todos, replace: (todos) => void (state.todos = todos) },
    () => state.failures++,
    () => NOW,
  );
  /** A local edit the way the UI makes one: show `after`, then hand it to the engine. */
  const edit = (after: Todo[]) => {
    const before = state.todos;
    state.todos = after;
    return engine.edit(before, after);
  };
  return { server, state, engine, edit };
}

describe("SyncEngine", () => {
  it("pushes an add and keeps the stored row", async () => {
    const { server, state, edit } = setup();
    await edit([todo("a")]);
    expect(server.pushes).toHaveLength(1);
    expect(server.rows.get("a")?.title).toBe("Todo a");
    expect(state.todos.map((t) => t.id)).toEqual(["a"]);
    expect(state.failures).toBe(0);
  });

  it("pushes a delete as a tombstone", async () => {
    const { server, edit } = setup();
    await edit([todo("a"), todo("b")]);
    await edit([todo("b")]);
    expect(server.rows.get("a")?.deleted_at).toBe(NOW.toISOString());
  });

  it("rolls back a failed push and reports it", async () => {
    const { server, state, edit } = setup([todo("a")]);
    server.failPush = true;
    await edit([todo("a", { title: "Renamed", updatedAt: T1 })]);
    expect(state.todos).toEqual([todo("a")]);
    expect(state.failures).toBe(1);
  });

  it("rolls back a failed add", async () => {
    const { server, state, edit } = setup([todo("a")]);
    server.failPush = true;
    await edit([todo("new"), todo("a")]);
    expect(state.todos.map((t) => t.id)).toEqual(["a"]);
  });

  it("gives an undone delete a fresh id so it survives the tombstone", async () => {
    const { server, state, edit } = setup();
    await edit([todo("a")]);
    await edit([]);
    await edit([todo("a")]);
    expect(state.todos).toHaveLength(1);
    const restored = state.todos[0];
    expect(restored.id).not.toBe("a");
    expect(server.rows.get(restored.id)?.deleted_at).toBeNull();
  });

  it("stamps an undone edit with now so it wins on the server", async () => {
    const { server, state, edit } = setup([todo("a")]);
    await edit([todo("a", { completed: true, completedAt: T1, updatedAt: T1 })]);
    await edit([todo("a")]);
    expect(server.rows.get("a")?.completed).toBe(false);
    expect(state.todos[0].completed).toBe(false);
  });

  it("pulls every page and advances the cursor", async () => {
    const { server, state, engine } = setup();
    for (let i = 0; i < PULL_PAGE_SIZE + 3; i++) server.write({ id: `r${i}` });
    await engine.pull();
    expect(server.pulls).toEqual([0, PULL_PAGE_SIZE]);
    expect(state.todos).toHaveLength(PULL_PAGE_SIZE + 3);
    expect(state.cursor).toBe(PULL_PAGE_SIZE + 3);
    await engine.pull();
    expect(server.pulls.at(-1)).toBe(PULL_PAGE_SIZE + 3);
  });

  it("pulls another device's edit and delete", async () => {
    const { server, state, engine } = setup();
    server.write({ id: "a" });
    server.write({ id: "b" });
    await engine.pull();
    server.write({ id: "a", title: "Edited elsewhere", updated_at: "2026-01-05T11:00:00.000Z" });
    server.write({ id: "b", deleted_at: T1 });
    await engine.pull();
    expect(state.todos.map((t) => t.title)).toEqual(["Edited elsewhere"]);
  });

  it("applyRemote ignores rows at or below the cursor", () => {
    const { state, engine } = setup();
    state.cursor = 5;
    engine.applyRemote([{ ...rowOf("a"), server_seq: 5 }]);
    expect(state.todos).toEqual([]);
  });

  it("ignores results after close", async () => {
    const { server, state, engine, edit } = setup([todo("a")]);
    server.failPush = true;
    const pending = edit([]);
    engine.close();
    await pending;
    expect(state.todos).toEqual([]);
    expect(state.failures).toBe(0);
  });
});

function rowOf(id: string): TodoRow {
  return {
    id,
    user_id: USER,
    title: id,
    notes: null,
    completed: false,
    priority: "medium",
    due_date: null,
    recurrence: null,
    completed_at: null,
    created_at: T0,
    updated_at: T1,
    deleted_at: null,
    server_seq: 1,
  };
}
