import { localDateKey } from "./stats";
import type { Todo } from "./types";

/** The Today view's groups. Each keeps the input order (the user's chosen sort). */
export type DaybookSections = {
  /** Open, due before today. Shown first, without guilt ("From Fri"). */
  slipped: Todo[];
  /** Open, due today or undated. */
  today: Todo[];
  /** Open, due after today. */
  later: Todo[];
  done: Todo[];
};

export type DaybookProgress = { done: number; total: number };

export type UpcomingDay = { date: string; todos: Todo[] };

/** Splits todos into the Today view's groups; `today` is a YYYY-MM-DD key. */
export function daybookSections(todos: readonly Todo[], today: string): DaybookSections {
  const sections: DaybookSections = { slipped: [], today: [], later: [], done: [] };
  for (const todo of todos) {
    if (todo.completed) sections.done.push(todo);
    else if (todo.dueDate && todo.dueDate < today) sections.slipped.push(todo);
    else if (todo.dueDate && todo.dueDate > today) sections.later.push(todo);
    else sections.today.push(todo);
  }
  return sections;
}

/**
 * Progress ring: todos completed today out of today's load (completed today plus open
 * slipped, due-today and undated todos), in `timeZone` or the device zone.
 */
export function daybookProgress(todos: readonly Todo[], now: Date, timeZone?: string): DaybookProgress {
  const today = localDateKey(now, timeZone);
  let done = 0;
  let open = 0;
  for (const todo of todos) {
    if (todo.completed) {
      const at = todo.completedAt ? new Date(todo.completedAt) : undefined;
      if (at && !Number.isNaN(at.getTime()) && localDateKey(at, timeZone) === today) done++;
    } else if (!todo.dueDate || todo.dueDate <= today) {
      open++;
    }
  }
  return { done, total: done + open };
}

/** Open todos due today or later, one entry per due date, soonest first. */
export function upcomingDays(todos: readonly Todo[], today: string): UpcomingDay[] {
  const byDate = new Map<string, Todo[]>();
  for (const todo of todos) {
    if (todo.completed || !todo.dueDate || todo.dueDate < today) continue;
    const list = byDate.get(todo.dueDate);
    if (list) list.push(todo);
    else byDate.set(todo.dueDate, [todo]);
  }
  return [...byDate.keys()].sort().map((date) => ({ date, todos: byDate.get(date)! }));
}
