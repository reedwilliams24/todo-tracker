import type { ReminderOffset, Todo } from "./types";

export const REMINDER_OFFSETS: ReminderOffset[] = ["at", "1h", "1d"];

export const REMINDER_LABELS: Record<ReminderOffset, string> = {
  at: "When due",
  "1h": "1 hour before",
  "1d": "1 day before",
};

/** Date-only due dates are treated as due at this local hour. */
export const DUE_HOUR = 9;

const OFFSET_MS: Record<ReminderOffset, number> = {
  at: 0,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

/** Local-time instant a date-only due date becomes due. */
export function dueAt(dueDate: string): Date {
  const [y, m, d] = dueDate.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, DUE_HOUR, 0, 0, 0);
}

export function reminderAt(todo: Todo): Date | undefined {
  if (!todo.dueDate || !todo.reminder) return undefined;
  return new Date(dueAt(todo.dueDate).getTime() - OFFSET_MS[todo.reminder]);
}

export type Reminder = {
  /** Stable per todo + reminder time; changes if the due date or offset changes. */
  key: string;
  todoId: string;
  title: string;
  body: string;
  at: Date;
};

export function describeReminder(todo: Todo): string {
  if (!todo.reminder) return "";
  return todo.reminder === "at"
    ? `Due today: ${todo.title}`
    : `Due ${todo.reminder === "1h" ? "in 1 hour" : "tomorrow"}: ${todo.title}`;
}

/** Reminders for every open todo that has a due date and a reminder offset. */
export function planReminders(todos: readonly Todo[]): Reminder[] {
  const out: Reminder[] = [];
  for (const todo of todos) {
    if (todo.completed) continue;
    const at = reminderAt(todo);
    if (!at) continue;
    out.push({
      key: `${todo.id}:${at.getTime()}`,
      todoId: todo.id,
      title: "Todo Tracker",
      body: describeReminder(todo),
      at,
    });
  }
  return out;
}

/** Reminders whose time has passed and that have not been delivered yet. */
export function dueReminders(
  todos: readonly Todo[],
  delivered: ReadonlySet<string>,
  now: Date = new Date(),
): Reminder[] {
  return planReminders(todos).filter((r) => r.at.getTime() <= now.getTime() && !delivered.has(r.key));
}

/** Drop delivered keys that no longer correspond to a planned reminder. */
export function pruneDelivered(delivered: ReadonlySet<string>, todos: readonly Todo[]): Set<string> {
  const live = new Set(planReminders(todos).map((r) => r.key));
  return new Set([...delivered].filter((key) => live.has(key)));
}
