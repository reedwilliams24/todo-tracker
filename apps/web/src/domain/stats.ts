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

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Calendar date (YYYY-MM-DD) of an instant in `timeZone` (an IANA name such as
 * "America/New_York"), or in the device's local time zone when omitted.
 */
export function localDateKey(date: Date, timeZone?: string): string {
  if (!timeZone) return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Adds whole calendar days to a YYYY-MM-DD key. Pure date math, so DST never skips or repeats a day. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Completions per calendar day, for completed todos with a valid `completedAt`. */
export function completionsByDay(todos: readonly Todo[], timeZone?: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const todo of todos) {
    if (!todo.completed || !todo.completedAt) continue;
    const at = new Date(todo.completedAt);
    if (Number.isNaN(at.getTime())) continue;
    const key = localDateKey(at, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function lastDays(counts: ReadonlyMap<string, number>, days: number, today: string): DayCount[] {
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysToKey(today, -i);
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

/**
 * Consecutive days with a completion, ending today or yesterday (today does
 * not break a streak until it is over).
 */
export function currentStreak(counts: ReadonlyMap<string, number>, today: string): number {
  let cursor = counts.has(today) ? today : addDaysToKey(today, -1);
  let streak = 0;
  while (counts.has(cursor)) {
    streak++;
    cursor = addDaysToKey(cursor, -1);
  }
  return streak;
}

export function longestStreak(counts: ReadonlyMap<string, number>): number {
  let best = 0;
  let run = 0;
  let previous: string | undefined;
  for (const key of [...counts.keys()].sort()) {
    run = previous && addDaysToKey(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return best;
}

export function computeStats(
  todos: readonly Todo[],
  now: Date = new Date(),
  days: number = STATS_DAYS,
  timeZone?: string,
): TodoStats {
  const counts = completionsByDay(todos, timeZone);
  const today = localDateKey(now, timeZone);
  let totalCompleted = 0;
  for (const count of counts.values()) totalCompleted += count;
  return {
    perDay: lastDays(counts, days, today),
    totalCompleted,
    currentStreak: currentStreak(counts, today),
    longestStreak: longestStreak(counts),
  };
}
