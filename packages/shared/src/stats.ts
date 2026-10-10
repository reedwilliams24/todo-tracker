import type { Todo } from "./types";

export type DayCount = { date: string; count: number };

export type TodoStats = {
  /** Oldest first, exactly `days` entries ending today. */
  perDay: DayCount[];
  totalCompleted: number;
  currentStreak: number;
  longestStreak: number;
};

export const STATS_DAYS = 30;

/** Local calendar date (YYYY-MM-DD) for an instant. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Completed-per-local-day counts for every day that has at least one completion. */
export function completionsByDay(todos: readonly Todo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const todo of todos) {
    if (!todo.completed || !todo.completedAt) continue;
    const key = localDateKey(new Date(todo.completedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function lastDays(counts: ReadonlyMap<string, number>, days: number, now: Date): DayCount[] {
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = localDateKey(shiftDays(now, -i));
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

/**
 * Current streak counts consecutive days with a completion ending today or
 * yesterday (today does not break a streak until it is over).
 */
export function currentStreak(counts: ReadonlyMap<string, number>, now: Date): number {
  let cursor = now;
  if (!counts.has(localDateKey(cursor))) cursor = shiftDays(cursor, -1);
  let streak = 0;
  while (counts.has(localDateKey(cursor))) {
    streak++;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(counts: ReadonlyMap<string, number>): number {
  const days = [...counts.keys()].sort();
  let best = 0;
  let run = 0;
  let previous: Date | undefined;
  for (const key of days) {
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    run = previous && localDateKey(shiftDays(previous, 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

export function computeStats(
  todos: readonly Todo[],
  now: Date = new Date(),
  days: number = STATS_DAYS,
): TodoStats {
  const counts = completionsByDay(todos);
  let totalCompleted = 0;
  for (const count of counts.values()) totalCompleted += count;
  return {
    perDay: lastDays(counts, days, now),
    totalCompleted,
    currentStreak: currentStreak(counts, now),
    longestStreak: longestStreak(counts),
  };
}
