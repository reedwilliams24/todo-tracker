import { parseStoredSort, parseStoredTodos, SORT_STORAGE_KEY, serializeTodos } from "web/domain";
import { T1, todo, done, sample } from "../helpers";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "storage",
  spec: "features/storage.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "parse valid list", op: "parseStoredTodos", given: { raw: JSON.stringify(sample) } },
    { name: "parse null", op: "parseStoredTodos", given: { raw: null } },
    { name: "parse empty string", op: "parseStoredTodos", given: { raw: "" } },
    { name: "parse corrupt JSON", op: "parseStoredTodos", given: { raw: "[{oops" } },
    { name: "parse non-array JSON", op: "parseStoredTodos", given: { raw: '{"id":"a"}' } },
    { name: "serialize round-trips", op: "serializeTodos", given: { todos: sample } },
    {
      name: "parse keeps recurrence",
      op: "parseStoredTodos",
      given: { raw: JSON.stringify([todo("r", { title: "Gym", recurrence: "weekly", dueDate: "2026-01-05" })]) },
    },
    {
      name: "parse keeps completedAt",
      op: "parseStoredTodos",
      given: { raw: JSON.stringify([done("a", T1), todo("b")]) },
    },
    { name: "sort preference key", op: "sortStorageKey", given: {} },
    ...[
      ["manual", "manual"],
      ["priority", "priority"],
      ["missing falls back to priority", null],
      ["unknown falls back to priority", "bogus"],
    ].map(([label, raw]) => ({ name: `parseStoredSort: ${label}`, op: "parseStoredSort", given: { raw } })),
  ],
};

export const ops: Ops = {
  parseStoredSort: (g) => parseStoredSort(g.raw),
  sortStorageKey: () => SORT_STORAGE_KEY,
  parseStoredTodos: (g) => parseStoredTodos(g.raw),
  serializeTodos: (g) => JSON.parse(serializeTodos(g.todos)),
};
