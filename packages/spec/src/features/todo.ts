import {
  createTodo,
  DEFAULT_PRIORITY,
  EMPTY_TODO_FORM,
  isOverdue,
  isValidDueDate,
  isValidTitle,
  PRIORITY_ORDER,
  STORAGE_KEY,
  toDateKey,
  toggleTodo,
  toTodoDraft,
  UNDO_TIMEOUT_MS,
  updateTodoText,
  type TodoFormState,
} from "web/domain";
import { T0, T1, T2, todo, done, sample } from "../helpers";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "todo",
  spec: "features/todo.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "constants", given: {} },
    ...[
      ["plain", "Buy milk", true],
      ["empty", "", false],
      ["whitespace only", "   \t ", false],
      ["padded", "  Buy milk  ", true],
      ["200 chars", "x".repeat(200), true],
      ["201 chars", "x".repeat(201), false],
      ["201 chars with padding trims to 200", ` ${"x".repeat(200)} `, true],
    ].map(([label, title]) => ({ name: `isValidTitle: ${label}`, op: "isValidTitle", given: { title } })),
    ...[
      ["empty means no date", ""],
      ["valid", "2026-02-28"],
      ["leap day", "2028-02-29"],
      ["not a leap year", "2026-02-29"],
      ["month 13", "2026-13-01"],
      ["single digit parts", "2026-1-5"],
      ["with time", "2026-01-05T00:00"],
      ["garbage", "tomorrow"],
    ].map(([label, value]) => ({ name: `isValidDueDate: ${label}`, op: "isValidDueDate", given: { value } })),
    {
      name: "toTodoDraft trims title and drops empty due date",
      op: "toTodoDraft",
      given: { form: { title: "  Buy milk ", priority: "high", dueDate: "" } },
    },
    {
      name: "toTodoDraft keeps due date",
      op: "toTodoDraft",
      given: { form: { title: "Pay rent", priority: "low", dueDate: "2026-02-01" } },
    },
    { name: "createTodo defaults", op: "createTodo", given: { draft: { title: "  Buy milk  " }, now: T0 } },
    {
      name: "createTodo with every field",
      op: "createTodo",
      given: { draft: { title: "Pay rent", notes: "  by transfer ", priority: "high", dueDate: "2026-02-01" }, now: T0 },
    },
    {
      name: "toTodoDraft keeps reminder with a due date",
      op: "toTodoDraft",
      given: { form: { title: "Pay rent", priority: "medium", dueDate: "2026-02-01", reminder: "1d" } },
    },
    {
      name: "toTodoDraft drops reminder without a due date",
      op: "toTodoDraft",
      given: { form: { title: "Pay rent", priority: "medium", dueDate: "", reminder: "1h" } },
    },
    {
      name: "toTodoDraft drops empty reminder",
      op: "toTodoDraft",
      given: { form: { title: "Pay rent", priority: "medium", dueDate: "2026-02-01", reminder: "" } },
    },
    {
      name: "createTodo keeps reminder with a due date",
      op: "createTodo",
      given: { draft: { title: "Pay rent", dueDate: "2026-02-01", reminder: "at" }, now: T0 },
    },
    {
      name: "createTodo drops reminder without a due date",
      op: "createTodo",
      given: { draft: { title: "Pay rent", reminder: "1d" }, now: T0 },
    },
    { name: "createTodo drops blank notes", op: "createTodo", given: { draft: { title: "Read", notes: "   " }, now: T0 } },
    { name: "toggleTodo completes", op: "toggleTodo", given: { todo: todo("a"), now: T1 } },
    { name: "toggleTodo reopens", op: "toggleTodo", given: { todo: todo("a", { completed: true }), now: T1 } },
    {
      name: "toggleTodo reopening clears completedAt",
      op: "toggleTodo",
      given: { todo: done("a", T1), now: T2 },
    },
    {
      name: "updateTodoText renames and bumps updatedAt",
      op: "updateTodoText",
      given: { todos: sample, id: "a", text: "  Buy oat milk ", now: T1 },
    },
    { name: "updateTodoText ignores blank text", op: "updateTodoText", given: { todos: sample, id: "a", text: "  ", now: T1 } },
    {
      name: "updateTodoText ignores unchanged text",
      op: "updateTodoText",
      given: { todos: sample, id: "a", text: " Buy milk ", now: T1 },
    },
    { name: "updateTodoText ignores unknown id", op: "updateTodoText", given: { todos: sample, id: "zzz", text: "New", now: T1 } },
    {
      name: "updateTodoText rejects titles over 200 chars",
      op: "updateTodoText",
      given: { todos: sample, id: "a", text: "x".repeat(201), now: T1 },
    },
    // Overdue uses the local calendar date of `now` (local time, no Z).
    ...([
      ["due yesterday", { dueDate: "2026-01-04" }, "2026-01-05T09:00:00"],
      ["due today", { dueDate: "2026-01-05" }, "2026-01-05T09:00:00"],
      ["due tomorrow", { dueDate: "2026-01-06" }, "2026-01-05T09:00:00"],
      ["undated", {}, "2026-01-05T09:00:00"],
      ["completed and past due", { dueDate: "2026-01-04", completed: true }, "2026-01-05T09:00:00"],
      ["due today, just before midnight", { dueDate: "2026-01-05" }, "2026-01-05T23:59:00"],
      ["due yesterday, just after midnight", { dueDate: "2026-01-04" }, "2026-01-05T00:01:00"],
    ] as const).map(([label, overrides, now]) => ({
      name: `isOverdue: ${label}`,
      op: "isOverdue",
      given: { todo: todo("a", overrides), now },
    })),
    ...["2026-01-05T00:00:00", "2026-01-05T23:59:59", "2026-12-31T12:00:00"].map((now) => ({
      name: `toDateKey: ${now}`,
      op: "toDateKey",
      given: { now },
    })),
  ],
};

export const ops: Ops = {
  constants: () => ({
    storageKey: STORAGE_KEY,
    undoTimeoutMs: UNDO_TIMEOUT_MS,
    defaultPriority: DEFAULT_PRIORITY,
    priorityOrder: PRIORITY_ORDER,
    emptyForm: EMPTY_TODO_FORM,
  }),
  isValidTitle: (g) => isValidTitle(g.title),
  isValidDueDate: (g) => isValidDueDate(g.value),
  toTodoDraft: (g) => toTodoDraft(g.form as TodoFormState),
  createTodo: (g) => createTodo(g.draft, new Date(g.now)),
  updateTodoText: (g) => updateTodoText(g.todos, g.id, g.text, new Date(g.now)),
  toggleTodo: (g) => toggleTodo(g.todo, new Date(g.now)),
  isOverdue: (g) => isOverdue(g.todo, new Date(g.now)),
  toDateKey: (g) => toDateKey(new Date(g.now)),
};
