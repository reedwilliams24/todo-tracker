import { describe, expect, it } from "vitest";
import {
  countRemaining,
  createTodo,
  filterTodos,
  isValidTitle,
  searchTodos,
  sortByPriority,
  sortTodos,
  toggleTodo,
  updateTodoText,
} from "./todos";

const draft = { title: "  Write tests  " };

describe("createTodo", () => {
  it("trims the title and defaults to medium priority", () => {
    const todo = createTodo(draft);
    expect(todo.title).toBe("Write tests");
    expect(todo.priority).toBe("medium");
    expect(todo.completed).toBe(false);
  });
});

describe("toggleTodo", () => {
  it("flips completion and bumps updatedAt", () => {
    const todo = createTodo(draft, new Date("2024-01-01T00:00:00.000Z"));
    const toggled = toggleTodo(todo, new Date("2024-01-02T00:00:00.000Z"));
    expect(toggled.completed).toBe(true);
    expect(toggled.updatedAt).toBe("2024-01-02T00:00:00.000Z");
  });
});

describe("updateTodoText", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");
  const later = new Date("2024-01-02T00:00:00.000Z");

  it("updates only the matching todo and trims the text", () => {
    const a = createTodo({ title: "a" }, now);
    const b = createTodo({ title: "b" }, now);
    const result = updateTodoText([a, b], a.id, "  renamed  ", later);
    expect(result[0]).toMatchObject({ id: a.id, title: "renamed", updatedAt: later.toISOString() });
    expect(result[1]).toBe(b);
  });

  it("rejects empty or whitespace-only text", () => {
    const a = createTodo({ title: "a" }, now);
    expect(updateTodoText([a], a.id, "   ")).toEqual([a]);
    expect(updateTodoText([a], a.id, "")).toEqual([a]);
  });

  it("leaves the todo untouched when the text is unchanged", () => {
    const a = createTodo({ title: "a" }, now);
    expect(updateTodoText([a], a.id, " a ", later)[0]).toBe(a);
  });

  it("does nothing for an unknown id", () => {
    const a = createTodo({ title: "a" }, now);
    expect(updateTodoText([a], "missing", "x")).toEqual([a]);
  });
});

describe("filterTodos", () => {
  it("splits active and completed", () => {
    const active = createTodo({ title: "a" });
    const done = toggleTodo(createTodo({ title: "b" }));
    const todos = [active, done];
    expect(filterTodos(todos, "active")).toEqual([active]);
    expect(filterTodos(todos, "completed")).toEqual([done]);
    expect(filterTodos(todos, "all")).toHaveLength(2);
  });
});

describe("searchTodos", () => {
  const milk = createTodo({ title: "Buy Milk", notes: "oat, from the corner shop" });
  const dog = createTodo({ title: "Walk the dog" });
  const todos = [milk, dog];

  it("matches case-insensitively on title", () => {
    expect(searchTodos(todos, "MILK")).toEqual([milk]);
    expect(searchTodos(todos, "the")).toEqual([milk, dog]);
  });

  it("matches on notes", () => {
    expect(searchTodos(todos, "corner")).toEqual([milk]);
  });

  it("returns everything for an empty or whitespace query", () => {
    expect(searchTodos(todos, "")).toEqual(todos);
    expect(searchTodos(todos, "   ")).toEqual(todos);
  });

  it("trims the query and returns nothing on no match", () => {
    expect(searchTodos(todos, " dog ")).toEqual([dog]);
    expect(searchTodos(todos, "cat")).toEqual([]);
  });
});

describe("sortTodos", () => {
  it("puts incomplete high-priority items first", () => {
    const low = createTodo({ title: "low", priority: "low" });
    const high = createTodo({ title: "high", priority: "high" });
    const doneHigh = toggleTodo(createTodo({ title: "done", priority: "high" }));
    expect(sortTodos([doneHigh, low, high]).map((t) => t.title)).toEqual(["high", "low", "done"]);
  });
});

describe("countRemaining", () => {
  it("counts only incomplete todos", () => {
    expect(countRemaining([createTodo({ title: "a" }), toggleTodo(createTodo({ title: "b" }))])).toBe(1);
  });
});

describe("isValidTitle", () => {
  it("rejects blank titles", () => {
    expect(isValidTitle("   ")).toBe(false);
    expect(isValidTitle("ok")).toBe(true);
  });
});

describe("sortByPriority", () => {
  it("orders high, medium, low with completed last", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const low = createTodo({ title: "low", priority: "low" }, now);
    const medium = createTodo({ title: "medium" }, now);
    const high = createTodo({ title: "high", priority: "high" }, now);
    const doneHigh = toggleTodo(createTodo({ title: "done", priority: "high" }, now));
    expect(sortByPriority([low, doneHigh, medium, high]).map((t) => t.title)).toEqual([
      "high",
      "medium",
      "low",
      "done",
    ]);
  });
});
