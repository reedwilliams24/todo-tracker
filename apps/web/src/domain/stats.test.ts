import { describe, expect, it } from "vitest";
import { computeStats, localDateKey } from "./stats";
import { createTodo, toggleTodo } from "./todos";

function done(title: string, at: Date) {
  return toggleTodo(createTodo({ title }, at), at);
}

const now = new Date(2026, 2, 10, 15, 0); // Mar 10

describe("stats", () => {
  it("records completedAt on completion and clears it on reopen", () => {
    const todo = done("a", now);
    expect(todo.completedAt).toBe(now.toISOString());
    expect(toggleTodo(todo, now).completedAt).toBeUndefined();
  });

  it("buckets completions per local day over the window", () => {
    const todos = [
      done("a", new Date(2026, 2, 10, 0, 30)),
      done("b", new Date(2026, 2, 10, 23, 30)),
      done("c", new Date(2026, 2, 8, 12)),
      done("old", new Date(2026, 1, 1)),
      createTodo({ title: "open" }),
    ];
    const stats = computeStats(todos, now, 7);
    expect(stats.perDay).toHaveLength(7);
    expect(stats.perDay.at(-1)).toEqual({ date: "2026-03-10", count: 2 });
    expect(stats.perDay.at(-3)).toEqual({ date: "2026-03-08", count: 1 });
    expect(stats.perDay[0]!.date).toBe("2026-03-04");
    expect(stats.totalCompleted).toBe(4);
  });

  it("computes current and longest streaks", () => {
    const todos = [
      done("a", new Date(2026, 2, 9)),
      done("b", new Date(2026, 2, 8)),
      done("c", new Date(2026, 2, 1)),
      done("d", new Date(2026, 2, 2)),
      done("e", new Date(2026, 2, 3)),
    ];
    const stats = computeStats(todos, now);
    expect(stats.currentStreak).toBe(2); // yesterday + day before; today still open
    expect(stats.longestStreak).toBe(3);

    expect(computeStats([...todos, done("f", now)], now).currentStreak).toBe(3);
    expect(computeStats([done("x", new Date(2026, 2, 7))], now).currentStreak).toBe(0);
    expect(computeStats([], now)).toMatchObject({ currentStreak: 0, longestStreak: 0 });
  });

  it("handles DST transition days as consecutive", () => {
    // 2026-03-08 is the US DST start; consecutive local days must still chain.
    const todos = [done("a", new Date(2026, 2, 7, 12)), done("b", new Date(2026, 2, 8, 12)), done("c", new Date(2026, 2, 9, 12))];
    expect(computeStats(todos, new Date(2026, 2, 9, 20)).longestStreak).toBe(3);
    expect(localDateKey(new Date(2026, 2, 8, 0, 30))).toBe("2026-03-08");
  });
});
