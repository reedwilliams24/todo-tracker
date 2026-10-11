import {
  describeReminder,
  DUE_HOUR,
  dueReminders,
  planReminders,
  pruneDelivered,
  REMINDER_LABELS,
  REMINDER_OFFSETS,
  reminderAt,
  type Reminder,
} from "web/domain";
import { todo } from "../helpers";
import type { Feature, Ops } from "../types";

const reminderList = [
  todo("rent", { title: "Pay rent", dueDate: "2026-05-10", reminder: "1h" }),
  todo("plain", { title: "No reminder", dueDate: "2026-05-10" }),
  todo("later", { title: "Later", dueDate: "2026-05-10", reminder: "at" }),
  todo("done", { title: "Done", completed: true, dueDate: "2026-05-01", reminder: "at" }),
  todo("trip", { title: "Book trip", dueDate: "2026-05-11", reminder: "1d" }),
];

export const feature: Feature = {
  feature: "reminders",
  spec: "features/reminders.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "remindersConstants", given: {} },
    ...(["at", "1h", "1d"] as const).map((reminder) => ({
      name: `reminderAt: ${reminder}`,
      op: "reminderAt",
      given: { todo: todo("a", { dueDate: "2026-05-10", reminder }) },
    })),
    {
      name: "reminderAt: 1d on the 1st falls on the previous month",
      op: "reminderAt",
      given: { todo: todo("a", { dueDate: "2026-03-01", reminder: "1d" }) },
    },
    { name: "reminderAt: no reminder", op: "reminderAt", given: { todo: todo("a", { dueDate: "2026-05-10" }) } },
    { name: "reminderAt: no due date", op: "reminderAt", given: { todo: todo("a", { reminder: "at" }) } },
    ...(["at", "1h", "1d"] as const).map((reminder) => ({
      name: `describeReminder: ${reminder}`,
      op: "describeReminder",
      given: { todo: todo("a", { title: "Pay rent", dueDate: "2026-05-10", reminder }) },
    })),
    { name: "describeReminder: none", op: "describeReminder", given: { todo: todo("a", { title: "Pay rent" }) } },
    {
      name: "planReminders: open todos with a due date and reminder, in list order",
      op: "planReminders",
      given: { todos: reminderList },
    },
    {
      name: "dueReminders: only reminders whose time has come",
      op: "dueReminders",
      given: { todos: reminderList, delivered: [], now: "2026-05-10T08:30:00" },
    },
    {
      name: "dueReminders: boundary is inclusive",
      op: "dueReminders",
      given: { todos: reminderList, delivered: [], now: "2026-05-10T09:00:00" },
    },
    {
      name: "dueReminders: skips delivered keys",
      op: "dueReminders",
      given: { todos: reminderList, delivered: ["rent:2026-05-10:1h"], now: "2026-05-10T09:00:00" },
    },
    {
      name: "dueReminders: a moved due date fires again",
      op: "dueReminders",
      given: {
        todos: [todo("rent", { title: "Pay rent", dueDate: "2026-05-11", reminder: "1d" })],
        delivered: ["rent:2026-05-10:1d"],
        now: "2026-05-10T09:00:00",
      },
    },
    {
      name: "pruneDelivered drops keys with no planned reminder",
      op: "pruneDelivered",
      given: {
        todos: reminderList,
        delivered: ["later:2026-05-10:at", "rent:2026-05-09:1h", "done:2026-05-01:at", "gone:x:at"],
      },
    },
  ],
};

/** Local wall-clock `YYYY-MM-DDTHH:mm:ss` (no zone), the format reminder fixtures use. */
function localTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const reminderJson = (r: Reminder) => ({ ...r, at: localTime(r.at) });

export const ops: Ops = {
  remindersConstants: () => ({ reminderOffsets: REMINDER_OFFSETS, reminderLabels: REMINDER_LABELS, dueHour: DUE_HOUR }),
  reminderAt: (g) => {
    const at = reminderAt(g.todo);
    return at ? localTime(at) : null;
  },
  describeReminder: (g) => describeReminder(g.todo),
  planReminders: (g) => planReminders(g.todos).map(reminderJson),
  dueReminders: (g) => dueReminders(g.todos, new Set(g.delivered), new Date(g.now)).map(reminderJson),
  pruneDelivered: (g) => [...pruneDelivered(new Set(g.delivered), g.todos)].sort(),
};
