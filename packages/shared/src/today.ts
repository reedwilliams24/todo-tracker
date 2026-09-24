import type { Todo } from "./types";
import { sortTodos } from "./todos";

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type TodaySummary = {
  /** Open todos due today or overdue, then undated ones, sorted like the app. */
  todos: Todo[];
  dueToday: number;
  overdue: number;
  remaining: number;
};

/**
 * What a glanceable surface (widget, lock screen) should show: open todos
 * due today or earlier first, then undated ones, capped at `limit`.
 */
export function todaySummary(
  todos: readonly Todo[],
  now: Date = new Date(),
  limit: number = 5,
): TodaySummary {
  const today = localIsoDate(now);
  const open = todos.filter((todo) => !todo.completed);
  const dated = open.filter((todo) => todo.dueDate !== undefined && todo.dueDate <= today);
  const undated = open.filter((todo) => todo.dueDate === undefined);
  return {
    todos: [...sortTodos(dated), ...sortTodos(undated)].slice(0, limit),
    dueToday: dated.filter((todo) => todo.dueDate === today).length,
    overdue: dated.filter((todo) => todo.dueDate !== today).length,
    remaining: open.length,
  };
}
