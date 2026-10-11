import { generateId } from "../todos";
import type { Recurrence, Subtask, Todo, TodoPriority } from "../types";

/** One row of the backend `todos` table (spec/features/sync.md). Timestamps use the Todo format. */
export type TodoRow = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  completed: boolean;
  priority: TodoPriority;
  due_date: string | null;
  recurrence: Recurrence | null;
  completed_at: string | null;
  /** The checklist (REED-10), in order; null when the todo has none. */
  subtasks: Subtask[] | null;
  created_at: string;
  updated_at: string;
  /** Tombstone: set when the todo was deleted. */
  deleted_at: string | null;
  /** Assigned by the server on every write; null on rows the client hasn't pushed yet. */
  server_seq: number | null;
};

export const SYNC_COLUMNS = [
  "id",
  "user_id",
  "title",
  "notes",
  "completed",
  "priority",
  "due_date",
  "recurrence",
  "completed_at",
  "subtasks",
  "created_at",
  "updated_at",
  "deleted_at",
  "server_seq",
] as const satisfies readonly (keyof TodoRow)[];

/** The row to push for a todo. `deletedAt` turns it into a tombstone. `reminder` is device-local and not synced. */
export function toRow(todo: Todo, userId: string, deletedAt?: Date): TodoRow {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    notes: todo.notes ?? null,
    completed: todo.completed,
    priority: todo.priority,
    due_date: todo.dueDate ?? null,
    recurrence: todo.recurrence ?? null,
    completed_at: todo.completedAt ?? null,
    subtasks: todo.subtasks?.length ? todo.subtasks : null,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    deleted_at: deletedAt ? deletedAt.toISOString() : null,
    server_seq: null,
  };
}

export function fromRow(row: TodoRow): Todo {
  const todo: Todo = {
    id: row.id,
    title: row.title,
    completed: row.completed,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.notes !== null) todo.notes = row.notes;
  if (row.due_date !== null) todo.dueDate = row.due_date;
  if (row.recurrence !== null) todo.recurrence = row.recurrence;
  if (row.completed_at !== null) todo.completedAt = row.completed_at;
  if (row.subtasks?.length) todo.subtasks = row.subtasks;
  return todo;
}

/**
 * Applies pulled or Realtime rows to the local list. Rows at or below `cursor` are ignored, tombstones remove
 * the todo, and otherwise the newer `updated_at` wins (ties go to the server) against both the local copy and
 * any in-flight push for that todo.
 */
export function applyRemote(
  local: readonly Todo[],
  inFlight: readonly Todo[],
  rows: readonly TodoRow[],
  cursor: number,
): Todo[] {
  const pending = new Map(inFlight.map((todo) => [todo.id, todo]));
  const todos = [...local];
  for (const row of rows) {
    if (row.server_seq === null || row.server_seq <= cursor) continue;
    const index = todos.findIndex((todo) => todo.id === row.id);
    if (row.deleted_at !== null) {
      if (index >= 0) todos.splice(index, 1);
      continue;
    }
    const mine = pending.get(row.id);
    if (mine && mine.updatedAt > row.updated_at) continue;
    const current = index >= 0 ? todos[index] : undefined;
    if (current && current.updatedAt > row.updated_at) continue;
    const incoming = fromRow(row);
    if (current?.reminder && incoming.dueDate) incoming.reminder = current.reminder;
    if (index >= 0) todos[index] = incoming;
    else todos.unshift(incoming);
  }
  return todos;
}

/** The highest `server_seq` seen; never moves backwards. */
export function advanceCursor(cursor: number, rows: readonly TodoRow[]): number {
  return rows.reduce((max, row) => (row.server_seq !== null && row.server_seq > max ? row.server_seq : max), cursor);
}

/**
 * Undoes the local effect of a failed push. `before` is the list as it was before the edit. A failed todo goes
 * back to its `before` version, is removed if it was new, or is put back where it was if its delete failed.
 */
export function rollbackPush(local: readonly Todo[], before: readonly Todo[], failedIds: readonly string[]): Todo[] {
  const failed = new Set(failedIds);
  const prior = new Map(before.map((todo) => [todo.id, todo]));
  const todos: Todo[] = [];
  for (const todo of local) {
    if (!failed.has(todo.id)) todos.push(todo);
    else if (prior.has(todo.id)) todos.push(prior.get(todo.id)!);
  }
  before.forEach((todo, i) => {
    if (!failed.has(todo.id) || todos.some((t) => t.id === todo.id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = todos.findIndex((t) => t.id === before[j]!.id);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    todos.splice(at, 0, todo);
  });
  return todos;
}

/**
 * Rows for the sign-in "Move" choice: every guest todo becomes a new account row with a fresh id, so it never
 * overwrites an account todo. Its fields are kept and `updated_at` is the time of the move.
 */
export function guestToRows(guest: readonly Todo[], userId: string, now: Date): TodoRow[] {
  const stamp = now.toISOString();
  return guest.map((todo) => ({ ...toRow(todo, userId), id: generateId(), updated_at: stamp }));
}

/** A local edit ready to push: the list to show and the rows to send (spec/features/sync.md#push). */
export type PushPlan = { todos: Todo[]; rows: TodoRow[] };

function sameRow(a: TodoRow, b: TodoRow): boolean {
  return SYNC_COLUMNS.every((column) => JSON.stringify(a[column]) === JSON.stringify(b[column]));
}

/**
 * Turns a local edit (`before` -> `after`) into rows to push. Added or changed todos become rows, removed ones
 * tombstones. A change that doesn't move `updated_at` forward (an undo) is stamped `now` so it wins LWW, and a todo
 * brought back after its tombstone was pushed (`tombstoned`) gets a fresh id, since tombstones always win.
 */
export function planPush(
  before: readonly Todo[],
  after: readonly Todo[],
  tombstoned: readonly string[],
  userId: string,
  now: Date,
): PushPlan {
  const stamp = now.toISOString();
  const prior = new Map(before.map((todo) => [todo.id, todo]));
  const deleted = new Set(tombstoned);
  const kept = new Set(after.map((todo) => todo.id));
  const rows: TodoRow[] = [];
  const todos = after.map((todo) => {
    const prev = prior.get(todo.id);
    let next = todo;
    if (!prev) {
      if (deleted.has(todo.id)) next = { ...todo, id: generateId(), updatedAt: stamp };
    } else if (sameRow(toRow(prev, userId), toRow(todo, userId))) {
      return todo;
    } else if (todo.updatedAt <= prev.updatedAt) {
      next = { ...todo, updatedAt: stamp };
    }
    rows.push(toRow(next, userId));
    return next;
  });
  for (const prev of before) {
    if (!kept.has(prev.id)) rows.push(toRow({ ...prev, updatedAt: stamp }, userId, now));
  }
  return { todos, rows };
}
