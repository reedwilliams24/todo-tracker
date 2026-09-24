import { describe, expect, it } from "vitest";
import {
  countRemaining,
  createTodo,
  filterTodos,
  isOverdue,
  isValidTitle,
  searchTodos,
  sortByDue,
  sortTodos,
  toDateKey,
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

describe("isOverdue", () => {
  const today = new Date(2024, 5, 15, 12);

  it("is true only for incomplete todos due before today", () => {
    const past = createTodo({ title: "past", dueDate: "2024-06-14" });
    const todayTodo = createTodo({ title: "today", dueDate: "2024-06-15" });
    const future = createTodo({ title: "future", dueDate: "2024-06-16" });
    const undated = createTodo({ title: "none" });
    expect(isOverdue(past, today)).toBe(true);
    expect(isOverdue(todayTodo, today)).toBe(false);
    expect(isOverdue(future, today)).toBe(false);
    expect(isOverdue(undated, today)).toBe(false);
    expect(isOverdue(toggleTodo(past), today)).toBe(false);
  });

  it("uses the local calendar date", () => {
    expect(toDateKey(new Date(2024, 0, 5, 23, 59))).toBe("2024-01-05");
  });
});

describe("sortByDue", () => {
  it("orders by due date with undated last and completed at the end", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const late = createTodo({ title: "late", dueDate: "2024-03-01", priority: "high" }, now);
    const soon = createTodo({ title: "soon", dueDate: "2024-01-05", priority: "low" }, now);
    const none = createTodo({ title: "none", priority: "high" }, now);
    const done = toggleTodo(createTodo({ title: "done", dueDate: "2024-01-01" }, now));
    expect(sortByDue([none, done, late, soon]).map((t) => t.title)).toEqual([
      "soon",
      "late",
      "none",
      "done",
    ]);
    expect(sortTodos([none, late, soon], "due").map((t) => t.title)).toEqual(["soon", "late", "none"]);
    expect(sortTodos([none, late, soon]).map((t) => t.title)).toEqual(["late", "none", "soon"]);
  });
});
