import type { Todo } from "web/domain";

/** Shared builders for the case files in features/. */
export const T0 = "2026-01-05T09:00:00.000Z";
export const T1 = "2026-01-05T10:00:00.000Z";
export const T2 = "2026-01-05T11:00:00.000Z";

export function todo(id: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    title: overrides.title ?? `Todo ${id}`,
    completed: false,
    priority: "medium",
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

export function done(id: string, completedAt?: string): Todo {
  return todo(id, { completed: true, completedAt, updatedAt: completedAt ?? T0 });
}

export const sample = [
  todo("a", { title: "Buy milk", notes: "2% organic", priority: "high", createdAt: "2026-01-01T09:00:00.000Z" }),
  todo("b", { title: "Walk the dog", completed: true, createdAt: "2026-01-02T09:00:00.000Z" }),
  todo("c", { title: "Call mom", priority: "low", dueDate: "2026-01-06", createdAt: "2026-01-03T09:00:00.000Z" }),
];

export const dueSample = [
  todo("undated-high", { priority: "high" }),
  todo("done-soonest", { dueDate: "2026-01-01", completed: true }),
  todo("late-high", { priority: "high", dueDate: "2026-03-01" }),
  todo("soon-low", { priority: "low", dueDate: "2026-01-10" }),
  todo("soon-high", { priority: "high", dueDate: "2026-01-10" }),
  todo("undated-low-older", { priority: "low", createdAt: "2026-01-01T00:00:00.000Z" }),
  todo("undated-low-newer", { priority: "low", createdAt: "2026-01-02T00:00:00.000Z" }),
];
