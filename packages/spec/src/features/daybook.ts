import { daybookProgress, daybookSections, upcomingDays, type Todo } from "web/domain";
import { done, todo } from "../helpers";
import type { Feature, Ops } from "../types";

const today = "2026-03-10";
const mixed = [
  todo("slipped-old", { dueDate: "2026-03-06" }),
  todo("undated"),
  todo("later", { dueDate: "2026-03-12" }),
  todo("due-today", { dueDate: today }),
  todo("slipped-yesterday", { dueDate: "2026-03-09" }),
  done("done-today", "2026-03-10T09:00:00.000Z"),
  todo("done-overdue", { dueDate: "2026-03-01", completed: true }),
  todo("later-same-day", { dueDate: "2026-03-12" }),
  todo("next-month", { dueDate: "2026-04-01" }),
];

const ids = (todos: readonly Todo[]) => todos.map((t) => t.id);

export const feature: Feature = {
  feature: "daybook",
  spec: "features/daybook.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "daybookSections: no todos", op: "daybookSections", given: { todos: [], today } },
    {
      name: "daybookSections: slipped, today, later, done in input order",
      op: "daybookSections",
      given: { todos: mixed, today },
    },
    {
      name: "daybookProgress: no todos",
      op: "daybookProgress",
      given: { todos: [], now: "2026-03-10T15:00:00.000Z", timeZone: "UTC" },
    },
    {
      name: "daybookProgress: done today over done today plus open slipped, due-today and undated",
      op: "daybookProgress",
      given: {
        todos: [
          ...mixed,
          done("done-yesterday", "2026-03-09T12:00:00.000Z"),
          done("legacy"),
          done("garbage", "not a date"),
        ],
        now: "2026-03-10T15:00:00.000Z",
        timeZone: "UTC",
      },
    },
    {
      name: "daybookProgress: today follows the given time zone",
      op: "daybookProgress",
      given: {
        todos: [done("late", "2026-03-10T03:30:00.000Z"), todo("open", { dueDate: "2026-03-10" })],
        now: "2026-03-10T16:00:00.000Z",
        timeZone: "America/New_York",
      },
    },
    { name: "upcomingDays: no todos", op: "upcomingDays", given: { todos: [], today } },
    {
      name: "upcomingDays: open dated todos from today, grouped by day, soonest first",
      op: "upcomingDays",
      given: { todos: mixed, today },
    },
  ],
};

export const ops: Ops = {
  daybookSections: (g) => {
    const s = daybookSections(g.todos, g.today);
    return { slipped: ids(s.slipped), today: ids(s.today), later: ids(s.later), done: ids(s.done) };
  },
  daybookProgress: (g) => daybookProgress(g.todos, new Date(g.now), g.timeZone),
  upcomingDays: (g) => upcomingDays(g.todos, g.today).map((d) => ({ date: d.date, ids: ids(d.todos) })),
};
