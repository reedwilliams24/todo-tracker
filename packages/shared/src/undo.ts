import type { Todo } from "./types";

export const UNDO_TIMEOUT_MS = 5000;

/** A snapshot of the list before a destructive action, so it can be restored exactly. */
export type UndoEntry = {
  label: string;
  /** Full list (including order) before the action. */
  before: readonly Todo[];
  at: number;
};

export function describeUndo(action: "complete" | "delete", count: number): string {
  const noun = count === 1 ? "todo" : `${count} todos`;
  return action === "complete" ? `Completed ${noun}` : `Deleted ${noun}`;
}

export function createUndoEntry(label: string, before: readonly Todo[], now = Date.now()): UndoEntry {
  return { label, before, at: now };
}

export function isUndoExpired(entry: UndoEntry, now = Date.now(), timeoutMs = UNDO_TIMEOUT_MS): boolean {
  return now - entry.at >= timeoutMs;
}
