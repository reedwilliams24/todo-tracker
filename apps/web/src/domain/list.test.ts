import { describe, expect, it } from "vitest";
import { addTodos, clearCompletedInList, removeFromList, renameInList, toggleInList } from "./list";
import { parseStoredTodos, serializeTodos } from "./storage";
import { createTodo, isValidDueDate } from "./todos";

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
