import { describe, expect, it } from "vitest";
import {
  addTodos,
  clearCompletedInList,
  moveVisibleTodo,
  removeFromList,
  renameInList,
  reorderTodos,
  toggleInList,
} from "./list";
import { parseStoredSort, parseStoredTodos, serializeTodos } from "./storage";
import { createTodo, isValidDueDate, sortTodos } from "./todos";

describe("list operations", () => {
  it("prepends new todos and returns the created ones", () => {
    const existing = createTodo({ title: "old" });
    const { todos, created } = addTodos([existing], [{ title: "a" }, { title: "b" }]);
    expect(created.map((t) => t.title)).toEqual(["a", "b"]);
    expect(todos.map((t) => t.title)).toEqual(["a", "b", "old"]);
  });

  it("toggles, renames and removes by id without touching others", () => {
    const a = createTodo({ title: "a" });
    const b = createTodo({ title: "b" });
    expect(toggleInList([a, b], a.id).map((t) => t.completed)).toEqual([true, false]);
    expect(renameInList([a, b], b.id, "  c  ").map((t) => t.title)).toEqual(["a", "c"]);
    expect(removeFromList([a, b], [a.id])).toEqual([b]);
  });

  it("clears completed todos", () => {
    const a = createTodo({ title: "a" });
    const done = toggleInList([createTodo({ title: "b" })], "nope");
    const list = [a, { ...done[0]!, completed: true }];
    expect(clearCompletedInList(list)).toEqual([a]);
  });

  it("reorderTodos moves an item and ignores out-of-range indexes", () => {
    const [a, b, c] = ["a", "b", "c"].map((title) => createTodo({ title }));
    expect(reorderTodos([a!, b!, c!], 0, 2)).toEqual([b, c, a]);
    expect(reorderTodos([a!, b!, c!], 2, 0)).toEqual([c, a, b]);
    expect(reorderTodos([a!, b!, c!], 1, 1)).toEqual([a, b, c]);
    expect(reorderTodos([a!, b!, c!], 5, 0)).toEqual([a, b, c]);
  });

  it("moveVisibleTodo applies the displayed order to the stored list, leaving hidden rows in place", () => {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((title) => createTodo({ title }));
    // stored: a b c d; displayed (say, sorted): d c a with b hidden; drag a above d
    const result = moveVisibleTodo([a!, b!, c!, d!], [d!.id, c!.id, a!.id], a!.id, d!.id);
    expect(result).toEqual([a, b, d, c]);
    expect(sortTodos(result, "manual")).toEqual([a, b, d, c]);
    expect(moveVisibleTodo([a!, b!], [a!.id, b!.id], "nope", a!.id)).toEqual([a, b]);
  });

  it("parseStoredSort falls back to priority", () => {
    expect(parseStoredSort("manual")).toBe("manual");
    expect(parseStoredSort("bogus")).toBe("priority");
    expect(parseStoredSort(null)).toBe("priority");
  });
});

describe("isValidDueDate", () => {
  it("accepts empty or real calendar dates only", () => {
    expect(isValidDueDate("")).toBe(true);
    expect(isValidDueDate(undefined)).toBe(true);
    expect(isValidDueDate("2026-02-28")).toBe(true);
    expect(isValidDueDate("2026-02-30")).toBe(false);
    expect(isValidDueDate("2026-13-01")).toBe(false);
    expect(isValidDueDate("tomorrow")).toBe(false);
  });
});

describe("storage codec", () => {
  it("round-trips todos and tolerates garbage", () => {
    const todos = [createTodo({ title: "x" })];
    expect(parseStoredTodos(serializeTodos(todos))).toEqual(todos);
    expect(parseStoredTodos(null)).toEqual([]);
    expect(parseStoredTodos("not json")).toEqual([]);
    expect(parseStoredTodos('{"a":1}')).toEqual([]);
  });
});
