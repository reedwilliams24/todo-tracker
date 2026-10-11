import type { ReminderOffset, Todo } from "./types";

export const REMINDER_OFFSETS: ReminderOffset[] = ["at", "1h", "1d"];

export const REMINDER_LABELS: Record<ReminderOffset, string> = {
  at: "When due",
  "1h": "1 hour before",
  "1d": "1 day before",
};

/** Date-only due dates are treated as due at this local hour. */
export const DUE_HOUR = 9;

/** Calendar offset from the due moment, so reminders keep their wall-clock time across DST. */
const OFFSET: Record<ReminderOffset, { days: number; hours: number }> = {
  at: { days: 0, hours: 0 },
  "1h": { days: 0, hours: 1 },
  "1d": { days: 1, hours: 0 },
};

/** Local wall-clock time of the reminder: 09:00 on the due date, 08:00, or 09:00 the day before. */
export function reminderAt(todo: Todo): Date | undefined {
  if (!todo.dueDate || !todo.reminder) return undefined;
  const [y, m, d] = todo.dueDate.split("-").map(Number) as [number, number, number];
  const { days, hours } = OFFSET[todo.reminder];
  return new Date(y, m - 1, d - days, DUE_HOUR - hours, 0, 0, 0);
}

export type Reminder = {
  /** `<todoId>:<dueDate>:<offset>`; changes if the due date or offset changes. Time-zone independent. */
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
      key: `${todo.id}:${todo.dueDate}:${todo.reminder}`,
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
