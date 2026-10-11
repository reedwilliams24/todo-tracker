import {
  parseStoredTodos,
  serializeTodos,
} from "web/domain";
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
  ],
};

export const ops: Ops = {
  parseStoredTodos: (g) => parseStoredTodos(g.raw),
  serializeTodos: (g) => JSON.parse(serializeTodos(g.todos)),
};
