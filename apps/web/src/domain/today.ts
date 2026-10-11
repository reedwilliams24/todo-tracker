import type { Todo } from "./types";
import { sortByPriority } from "./todos";

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const TODAY_LIMIT = 5;

export type TodaySummary = {
  /** Open todos due today or overdue, then undated ones, each group sorted for display. */
  todos: Todo[];
  dueToday: number;
  overdue: number;
  remaining: number;
};

/**
 * What a glanceable surface (home-screen widget) shows: open todos due today
 * or earlier first, then undated ones, capped at `limit`. `now` is local time.
 */
export function todaySummary(todos: readonly Todo[], now: Date = new Date(), limit: number = TODAY_LIMIT): TodaySummary {
  const today = localIsoDate(now);
  const open = todos.filter((todo) => !todo.completed);
  const dated = open.filter((todo) => todo.dueDate !== undefined && todo.dueDate <= today);
  const undated = open.filter((todo) => todo.dueDate === undefined);
  return {
    todos: [...sortByPriority(dated), ...sortByPriority(undated)].slice(0, Math.max(0, limit)),
    dueToday: dated.filter((todo) => todo.dueDate === today).length,
    overdue: dated.filter((todo) => todo.dueDate !== today).length,
    remaining: open.length,
  };
}

/** Widget subtitle: "All done", or "2 overdue · 1 due today" (the overdue part only when > 0). */
export function todaySubtitle(summary: Pick<TodaySummary, "dueToday" | "overdue" | "remaining">): string {
  if (summary.remaining === 0) return "All done";
  const parts = summary.overdue > 0 ? [`${summary.overdue} overdue`] : [];
  return [...parts, `${summary.dueToday} due today`].join(" · ");
}

/** "+3 more" when open todos are hidden from the widget, else null. */
export function todayMoreLabel(summary: Pick<TodaySummary, "todos" | "remaining">): string | null {
  const hidden = summary.remaining - summary.todos.length;
  return hidden > 0 ? `+${hidden} more` : null;
}
