import { describe, expect, it } from "vitest";
import { createTodo } from "./todos";
import { todaySummary } from "./today";

const now = new Date(2026, 8, 24, 9);
const make = (title: string, dueDate?: string, completed = false) => ({
  ...createTodo({ title, dueDate }, now),
  completed,
});

describe("todaySummary", () => {
  it("lists overdue and today's open todos first, then undated, skipping done and future", () => {
    const todos = [
      make("future", "2026-10-01"),
      make("undated"),
      make("today", "2026-09-24"),
      make("done today", "2026-09-24", true),
      make("overdue", "2026-09-20"),
    ];
    const summary = todaySummary(todos, now);
    expect(summary.todos.map((todo) => todo.title)).toEqual(["overdue", "today", "undated"]);
    expect(summary.dueToday).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.remaining).toBe(4);
  });

  it("caps the list", () => {
    const todos = Array.from({ length: 8 }, (_, i) => make(`t${i}`, "2026-09-24"));
    expect(todaySummary(todos, now, 3).todos).toHaveLength(3);
    expect(todaySummary(todos, now, 3).dueToday).toBe(8);
  });
});
