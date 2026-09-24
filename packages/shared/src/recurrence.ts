import { createTodo } from "./todos";
import type { Recurrence, Todo } from "./types";

export const RECURRENCES: Recurrence[] = ["daily", "weekly", "monthly"];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Next due date after `dueDate` (YYYY-MM-DD). Computed on UTC calendar days so
 * DST transitions never shift the date; monthly clamps to the last day of the
 * target month (Jan 31 -> Feb 28/29).
 */
export function nextOccurrence(dueDate: string, recurrence: Recurrence): string {
  const [y, m, d] = dueDate.split("-").map(Number) as [number, number, number];
  switch (recurrence) {
    case "daily":
      return toDateString(new Date(Date.UTC(y, m - 1, d + 1)));
    case "weekly":
      return toDateString(new Date(Date.UTC(y, m - 1, d + 7)));
    case "monthly": {
      const lastOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      return toDateString(new Date(Date.UTC(y, m, Math.min(d, lastOfNext))));
    }
  }
}

/** The follow-up todo to schedule once a recurring todo is completed. */
export function scheduleNext(todo: Todo, now: Date = new Date()): Todo | undefined {
  if (!todo.recurrence) return undefined;
  return createTodo(
    {
      title: todo.title,
      notes: todo.notes,
      priority: todo.priority,
      recurrence: todo.recurrence,
      dueDate: nextOccurrence(todo.dueDate ?? toDateString(now), todo.recurrence),
    },
    now,
  );
}
