import { describe, expect, it } from "vitest";
import { createTodo } from "./todos";
import { createUndoEntry, describeUndo, isUndoExpired, UNDO_TIMEOUT_MS } from "./undo";

describe("undo", () => {
  it("describes single and bulk actions", () => {
    expect(describeUndo("complete", 1)).toBe("Completed todo");
    expect(describeUndo("delete", 3)).toBe("Deleted 3 todos");
  });

  it("keeps the exact previous list and expires after the timeout", () => {
    const before = [createTodo({ title: "a" }), createTodo({ title: "b" })];
    const entry = createUndoEntry("Deleted todo", before, 1000);
    expect(entry.before).toBe(before);
    expect(isUndoExpired(entry, 1000 + UNDO_TIMEOUT_MS - 1)).toBe(false);
    expect(isUndoExpired(entry, 1000 + UNDO_TIMEOUT_MS)).toBe(true);
  });
});
