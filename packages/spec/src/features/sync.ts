import {
  advanceCursor,
  applyRemote,
  fromRow,
  guestToRows,
  planPush,
  rollbackPush,
  SYNC_COLUMNS,
  toRow,
  type TodoRow,
} from "web/domain";
import { T0, T1, T2, todo } from "../helpers";
import type { Feature, Ops } from "../types";

const USER = "6a1f1c2e-0000-4000-8000-000000000001";
const NOW = "2026-01-06T12:00:00.000Z";
const CURSOR = 5;

function row(id: string, overrides: Partial<TodoRow> = {}): TodoRow {
  return {
    id,
    user_id: USER,
    title: `Todo ${id}`,
    notes: null,
    completed: false,
    priority: "medium",
    due_date: null,
    recurrence: null,
    completed_at: null,
    subtasks: null,
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    server_seq: CURSOR + 1,
    ...overrides,
  };
}

const full = todo("a", {
  title: "Pay rent",
  notes: "Before the 5th",
  completed: true,
  priority: "high",
  dueDate: "2026-02-01",
  reminder: "1d",
  recurrence: "monthly",
  completedAt: T1,
  subtasks: [
    { id: "s1", title: "Transfer money", completed: true },
    { id: "s2", title: "Email receipt", completed: true },
  ],
  createdAt: T0,
  updatedAt: T1,
});

const open = (id: string, title: string) => ({ id, title, completed: false });
const done = (id: string, title: string) => ({ id, title, completed: true });

const list = [todo("a", { updatedAt: T1 }), todo("b", { updatedAt: T1 }), todo("c", { updatedAt: T1 })];

const apply = (name: string, given: { local: unknown; inFlight?: unknown; rows: unknown; cursor?: number }) => ({
  name: `applyRemote: ${name}`,
  op: "applyRemote",
  given: { inFlight: [], cursor: CURSOR, ...given },
});

const plan = (name: string, given: { before: unknown; after: unknown; tombstoned?: string[] }) => ({
  name: `planPush: ${name}`,
  op: "planPush",
  given: { tombstoned: [], userId: USER, now: NOW, ...given },
});

export const feature: Feature = {
  feature: "sync",
  spec: "features/sync.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "syncConstants", given: {} },
    { name: "toRow: every field", op: "toRow", given: { todo: full, userId: USER } },
    { name: "toRow: unset optional fields become null", op: "toRow", given: { todo: todo("a"), userId: USER } },
    {
      name: "toRow: deletedAt makes a tombstone",
      op: "toRow",
      given: { todo: todo("a"), userId: USER, deletedAt: T2 },
    },
    {
      name: "fromRow: every column",
      op: "fromRow",
      given: {
        row: row("a", {
          title: "Pay rent",
          notes: "Before the 5th",
          completed: true,
          priority: "high",
          due_date: "2026-02-01",
          recurrence: "monthly",
          completed_at: T1,
          subtasks: [done("s1", "Transfer money"), open("s2", "Email receipt")],
          updated_at: T1,
          server_seq: 42,
        }),
      },
    },
    { name: "fromRow: null columns are left out", op: "fromRow", given: { row: row("a") } },
    {
      name: "toRow: an empty checklist becomes null",
      op: "toRow",
      given: { todo: todo("a", { subtasks: [] }), userId: USER },
    },
    { name: "fromRow: an empty checklist is left out", op: "fromRow", given: { row: row("a", { subtasks: [] }) } },
    apply("a new todo is added at the top", { local: list, rows: [row("d", { updated_at: T2 })] }),
    apply("a newer row replaces the local copy in place", {
      local: list,
      rows: [row("b", { title: "Renamed elsewhere", updated_at: T2 })],
    }),
    apply("an older row is ignored", { local: list, rows: [row("b", { title: "Stale", updated_at: T0 })] }),
    apply("tie: equal updated_at goes to the server", {
      local: list,
      rows: [row("b", { title: "Server copy", updated_at: T1 })],
    }),
    apply("a tombstone removes the todo", { local: list, rows: [row("b", { updated_at: T1, deleted_at: T1 })] }),
    apply("a tombstone beats a newer local edit", {
      local: list,
      rows: [row("b", { updated_at: T0, deleted_at: T0 })],
    }),
    apply("a tombstone beats a newer in-flight edit", {
      local: [todo("a", { title: "Mine", updatedAt: T2 })],
      inFlight: [todo("a", { title: "Mine", updatedAt: T2 })],
      rows: [row("a", { updated_at: T0, deleted_at: T1 })],
    }),
    apply("a tombstone for an unknown todo does nothing", {
      local: list,
      rows: [row("zzz", { deleted_at: T1 })],
    }),
    apply("rows at or below the cursor are ignored", {
      local: list,
      rows: [
        row("b", { title: "At cursor", updated_at: T2, server_seq: CURSOR }),
        row("c", { updated_at: T2, deleted_at: T2, server_seq: CURSOR - 2 }),
        row("d", { updated_at: T2, server_seq: 1 }),
      ],
    }),
    apply("a row without server_seq is ignored", {
      local: list,
      rows: [row("b", { title: "Not stored", updated_at: T2, server_seq: null })],
    }),
    apply("the echo of our own push changes nothing", {
      local: [todo("a", { title: "Mine", updatedAt: T1 }), todo("b")],
      rows: [row("a", { title: "Mine", updated_at: T1 })],
    }),
    apply("a newer in-flight edit is kept", {
      local: [todo("a", { title: "Mine", updatedAt: T2 })],
      inFlight: [todo("a", { title: "Mine", updatedAt: T2 })],
      rows: [row("a", { title: "Theirs", updated_at: T1 })],
    }),
    apply("an older in-flight edit loses to a newer row", {
      local: [todo("a", { title: "Mine", updatedAt: T1 })],
      inFlight: [todo("a", { title: "Mine", updatedAt: T1 })],
      rows: [row("a", { title: "Theirs", updated_at: T2 })],
    }),
    apply("tie: equal updated_at with an in-flight edit goes to the server", {
      local: [todo("a", { title: "Mine", updatedAt: T1 })],
      inFlight: [todo("a", { title: "Mine", updatedAt: T1 })],
      rows: [row("a", { title: "Theirs", updated_at: T1 })],
    }),
    apply("rows for the same todo apply in order", {
      local: [todo("a")],
      rows: [
        row("a", { title: "First", updated_at: T1, server_seq: 6 }),
        row("a", { title: "Second", updated_at: T2, server_seq: 7 }),
      ],
    }),
    apply("keeps the device's reminder while the row has a due date", {
      local: [todo("a", { dueDate: "2026-02-01", reminder: "1h" })],
      rows: [row("a", { title: "Renamed", due_date: "2026-02-02", updated_at: T1 })],
    }),
    apply("drops the device's reminder when the row clears the due date", {
      local: [todo("a", { dueDate: "2026-02-01", reminder: "1h" })],
      rows: [row("a", { updated_at: T1 })],
    }),
    apply("subtasks: a newer row replaces the checklist", {
      local: [todo("a", { subtasks: [open("s1", "Milk")], updatedAt: T1 })],
      rows: [row("a", { subtasks: [done("s1", "Milk"), open("s2", "Eggs")], updated_at: T2 })],
    }),
    apply("subtasks: an older row keeps the local checklist", {
      local: [todo("a", { subtasks: [done("s1", "Milk"), open("s2", "Eggs")], updatedAt: T2 })],
      rows: [row("a", { subtasks: [open("s1", "Milk")], updated_at: T1 })],
    }),
    apply("subtasks: a newer row without subtasks clears the checklist", {
      local: [todo("a", { subtasks: [open("s1", "Milk")], updatedAt: T1 })],
      rows: [row("a", { updated_at: T2 })],
    }),
    apply("subtasks: a newer in-flight toggle is kept", {
      local: [todo("a", { subtasks: [done("s1", "Milk")], completed: true, completedAt: T2, updatedAt: T2 })],
      inFlight: [todo("a", { subtasks: [done("s1", "Milk")], completed: true, completedAt: T2, updatedAt: T2 })],
      rows: [row("a", { subtasks: [open("s1", "Milk")], updated_at: T1 })],
    }),
    apply("first pull from cursor 0 fills an empty list", {
      local: [],
      cursor: 0,
      rows: [row("a", { server_seq: 1 }), row("b", { server_seq: 2 }), row("c", { server_seq: 3, deleted_at: T1 })],
    }),
    {
      name: "advanceCursor: moves to the highest server_seq",
      op: "advanceCursor",
      given: { cursor: CURSOR, rows: [row("a", { server_seq: 9 }), row("b", { server_seq: 7 })] },
    },
    {
      name: "advanceCursor: never decreases",
      op: "advanceCursor",
      given: { cursor: CURSOR, rows: [row("a", { server_seq: 2 })] },
    },
    { name: "advanceCursor: no rows", op: "advanceCursor", given: { cursor: CURSOR, rows: [] } },
    {
      name: "advanceCursor: rows without server_seq don't count",
      op: "advanceCursor",
      given: { cursor: CURSOR, rows: [row("a", { server_seq: null })] },
    },
    {
      name: "rollbackPush: restores the pre-edit version",
      op: "rollbackPush",
      given: {
        local: [todo("a"), todo("b", { title: "Edited", updatedAt: T1 }), todo("c")],
        before: [todo("a"), todo("b"), todo("c")],
        failedIds: ["b"],
      },
    },
    {
      name: "rollbackPush: removes a new todo that was never saved",
      op: "rollbackPush",
      given: { local: [todo("new"), todo("a")], before: [todo("a")], failedIds: ["new"] },
    },
    {
      name: "rollbackPush: puts a todo whose delete failed back in its place",
      op: "rollbackPush",
      given: { local: [todo("a"), todo("c")], before: [todo("a"), todo("b"), todo("c")], failedIds: ["b"] },
    },
    {
      name: "rollbackPush: a failed delete of the first todo goes back to the top",
      op: "rollbackPush",
      given: { local: [todo("b")], before: [todo("a"), todo("b")], failedIds: ["a"] },
    },
    {
      name: "rollbackPush: only failed todos roll back",
      op: "rollbackPush",
      given: {
        local: [todo("a", { title: "A2", updatedAt: T1 }), todo("b", { title: "B2", updatedAt: T1 })],
        before: [todo("a"), todo("b")],
        failedIds: ["b"],
      },
    },
    {
      name: "guestToRows: every guest todo becomes a new account row",
      op: "guestToRows",
      given: { guest: [full, todo("b", { title: "Walk the dog" })], userId: USER, now: NOW },
    },
    {
      name: "guestToRows: duplicate titles are all moved",
      op: "guestToRows",
      given: { guest: [todo("a", { title: "Buy milk" }), todo("b", { title: "Buy milk" })], userId: USER, now: NOW },
    },
    { name: "guestToRows: no guest todos", op: "guestToRows", given: { guest: [], userId: USER, now: NOW } },
    plan("an added todo becomes a row", { before: list, after: [todo("d", { updatedAt: T2 }), ...list] }),
    plan("an edited todo becomes a row", {
      before: list,
      after: [list[0], todo("b", { title: "Renamed", updatedAt: T2 }), list[2]],
    }),
    plan("a deleted todo becomes a tombstone stamped now", { before: list, after: [list[0], list[2]] }),
    plan("reordering pushes nothing", { before: list, after: [list[2], list[0], list[1]] }),
    plan("a reminder change alone pushes nothing", {
      before: [todo("a", { dueDate: "2026-02-01" })],
      after: [todo("a", { dueDate: "2026-02-01", reminder: "1h" })],
    }),
    plan("subtasks: a checklist change is stamped now and pushed", {
      before: [todo("a", { subtasks: [open("s1", "Milk")] })],
      after: [todo("a", { subtasks: [done("s1", "Milk")] })],
    }),
    plan("subtasks: an equal checklist pushes nothing", {
      before: [todo("a", { subtasks: [open("s1", "Milk")] })],
      after: [todo("a", { subtasks: [open("s1", "Milk")] })],
    }),
    plan("an undone edit is stamped now so it wins", {
      before: [todo("a", { title: "Renamed", updatedAt: T2 })],
      after: [todo("a", { updatedAt: T1 })],
    }),
    plan("a todo restored after its tombstone was pushed gets a new id", {
      before: [list[0]],
      after: list.slice(0, 2),
      tombstoned: ["b"],
    }),
    plan("a todo that reappears without a pushed tombstone keeps its id", {
      before: [list[0]],
      after: list.slice(0, 2),
    }),
    plan("no change pushes nothing", { before: list, after: list }),
  ],
};

/** Fixtures can't hold null values (spec/README.md#normalization), so rows list their null columns separately. */
function rowJson(row: TodoRow) {
  const entries = Object.entries(row);
  return {
    row: Object.fromEntries(entries.filter(([, value]) => value !== null)),
    nulls: entries
      .filter(([, value]) => value === null)
      .map(([key]) => key)
      .sort(),
  };
}

export const ops: Ops = {
  syncConstants: () => ({ columns: SYNC_COLUMNS }),
  toRow: (g) => rowJson(toRow(g.todo, g.userId, g.deletedAt ? new Date(g.deletedAt) : undefined)),
  fromRow: (g) => fromRow(g.row),
  applyRemote: (g) => applyRemote(g.local, g.inFlight, g.rows, g.cursor),
  advanceCursor: (g) => advanceCursor(g.cursor, g.rows),
  rollbackPush: (g) => rollbackPush(g.local, g.before, g.failedIds),
  guestToRows: (g) => guestToRows(g.guest, g.userId, new Date(g.now)).map(rowJson),
  planPush: (g) => {
    const { todos, rows } = planPush(g.before, g.after, g.tombstoned, g.userId, new Date(g.now));
    return { todos, rows: rows.map(rowJson) };
  },
};
