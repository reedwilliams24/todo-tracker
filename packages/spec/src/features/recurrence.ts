import {
  createTodo,
  nextOccurrence,
  RECURRENCES,
  scheduleNext,
  toggleInList,
  toTodoDraft,
  type Recurrence,
} from "web/domain";
import { T0, T1, T2, todo, sample } from "../helpers";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "recurrence",
  spec: "features/recurrence.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "recurrenceConstants", given: {} },
    ...[
      ["daily rolls over a month", "2026-01-31", "daily"],
      ["daily rolls over a year", "2026-12-31", "daily"],
      ["daily across spring-forward DST", "2026-03-07", "daily"],
      ["daily across fall-back DST", "2026-10-31", "daily"],
      ["weekly rolls over a month", "2026-02-26", "weekly"],
      ["weekly across DST", "2026-03-01", "weekly"],
      ["monthly keeps the day", "2026-12-15", "monthly"],
      ["monthly clamps to February", "2026-01-31", "monthly"],
      ["monthly clamps to a leap February", "2028-01-31", "monthly"],
      ["monthly clamps to a 30-day month", "2026-03-31", "monthly"],
      ["monthly from February 28", "2026-02-28", "monthly"],
    ].map(([label, dueDate, recurrence]) => ({
      name: `nextOccurrence: ${label}`,
      op: "nextOccurrence",
      given: { dueDate, recurrence },
    })),
    {
      name: "toTodoDraft keeps recurrence",
      op: "toTodoDraft",
      given: { form: { title: "Water plants", priority: "medium", dueDate: "2026-01-31", recurrence: "monthly" } },
    },
    {
      name: "toTodoDraft drops empty recurrence",
      op: "toTodoDraft",
      given: { form: { title: "Water plants", priority: "medium", dueDate: "", recurrence: "" } },
    },
    {
      name: "createTodo keeps recurrence",
      op: "createTodo",
      given: { draft: { title: "Gym", recurrence: "daily" }, now: T0 },
    },
    {
      name: "scheduleNext copies the todo with the next due date",
      op: "scheduleNext",
      given: {
        todo: todo("r", {
          title: "Water plants",
          notes: "balcony",
          priority: "high",
          dueDate: "2026-01-31",
          recurrence: "monthly",
          completed: true,
        }),
        now: T1,
      },
    },
    {
      name: "scheduleNext without a due date starts from today (UTC)",
      op: "scheduleNext",
      given: {
        todo: todo("r", { title: "Gym", recurrence: "daily", completed: true }),
        now: "2026-01-05T23:30:00.000Z",
      },
    },
    { name: "scheduleNext ignores non-recurring todos", op: "scheduleNext", given: { todo: todo("a"), now: T1 } },
    {
      name: "toggleInList: completing a recurring todo inserts the next one after it",
      op: "toggleInList",
      given: {
        todos: [sample[0], todo("r", { title: "Gym", recurrence: "weekly", dueDate: "2026-01-05" }), sample[2]],
        id: "r",
        now: T1,
      },
    },
    {
      name: "toggleInList: reopening a recurring todo schedules nothing",
      op: "toggleInList",
      given: {
        todos: [todo("r", { title: "Gym", recurrence: "daily", dueDate: "2026-01-05", completed: true })],
        id: "r",
        now: T1,
      },
    },
    {
      name: "toggleInList: non-recurring todo just toggles",
      op: "toggleInList",
      given: { todos: sample, id: "a", now: T1 },
    },
    {
      name: "undo of a recurring completion removes the scheduled todo",
      op: "applyActions",
      given: {
        todos: [todo("r", { title: "Gym", recurrence: "daily", dueDate: "2026-01-05" }), sample[0]],
        steps: [
          { action: "toggle", id: "r", now: T1 },
          { action: "undo", now: T2 },
        ],
      },
    },
    {
      name: "completing a recurring todo offers undo",
      op: "applyActions",
      given: {
        todos: [todo("r", { title: "Gym", recurrence: "daily", dueDate: "2026-01-05" })],
        steps: [{ action: "toggle", id: "r", now: T1 }],
      },
    },
  ],
};

export const ops: Ops = {
  recurrenceConstants: () => ({ recurrences: RECURRENCES }),
  nextOccurrence: (g) => nextOccurrence(g.dueDate, g.recurrence as Recurrence),
  scheduleNext: (g) => scheduleNext(g.todo, new Date(g.now)),
};
