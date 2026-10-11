import { describe, expect, it } from "vitest";
import { createTodo } from "../todos";
import { applyRemote, fromRow, guestToRows, SYNC_COLUMNS, toRow } from ".";

const now = new Date("2026-01-06T12:00:00.000Z");

describe("sync", () => {
  it("round-trips a todo through a row, minus the device-local reminder", () => {
    const todo = createTodo({ title: "Pay rent", notes: "x", dueDate: "2026-02-01", reminder: "1h" }, now);
    const row = toRow(todo, "user");
    expect(Object.keys(row)).toEqual([...SYNC_COLUMNS]);
    const { reminder: _reminder, ...synced } = todo;
    expect(fromRow(row)).toEqual(synced);
  });

  it("gives moved guest todos fresh ids", () => {
    const guest = [createTodo({ title: "a" }, now)];
    const [row] = guestToRows(guest, "user", now);
    expect(row!.id).not.toBe(guest[0]!.id);
  });

  it("does not mutate its inputs", () => {
    const local = [createTodo({ title: "a" }, now)];
    const row = { ...toRow(local[0]!, "user"), title: "b", updated_at: "2027-01-01T00:00:00.000Z", server_seq: 1 };
    const copy = structuredClone(local);
    applyRemote(local, [], [row], 0);
    expect(local).toEqual(copy);
  });
});
