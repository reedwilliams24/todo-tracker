import {
  addTodos,
  bulkToggle,
  clearCompletedInList,
  countCompleted,
  countRemaining,
  filterTodos,
  removeFromList,
  searchTodos,
  sortByDue,
  sortByPriority,
  sortTodos,
  toggleInList,
  type TodoFilter,
  type TodoSort,
} from "web/domain";
import { T1, todo, sample, dueSample } from "../helpers";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "list",
  spec: "features/list.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    ...(["all", "active", "completed"] as const).map((filter) => ({
      name: `filterTodos: ${filter}`,
      op: "filterTodos",
      given: { todos: sample, filter },
    })),
    ...[
      ["empty query returns everything", ""],
      ["blank query returns everything", "   "],
      ["matches title case-insensitively", "MILK"],
      ["matches notes", "organic"],
      ["trims query", "  dog "],
      ["no match", "zebra"],
    ].map(([label, query]) => ({ name: `searchTodos: ${label}`, op: "searchTodos", given: { todos: sample, query } })),
    { name: "countRemaining", op: "countRemaining", given: { todos: sample } },
    { name: "countRemaining empty", op: "countRemaining", given: { todos: [] } },
    {
      name: "sortByPriority: completed last, then priority, due date, creation",
      op: "sortByPriority",
      given: {
        todos: [
          todo("done-high", { priority: "high", completed: true }),
          todo("low", { priority: "low" }),
          todo("med-undated", { createdAt: "2026-01-01T00:00:00.000Z" }),
          todo("med-later", { dueDate: "2026-03-01" }),
          todo("med-sooner", { dueDate: "2026-02-01" }),
          todo("med-undated-newer", { createdAt: "2026-01-02T00:00:00.000Z" }),
          todo("high", { priority: "high" }),
        ],
      },
    },
    {
      name: "sortByDue: completed last, then due date (undated last), priority, creation",
      op: "sortByDue",
      given: { todos: dueSample },
    },
    { name: "sortTodos: priority", op: "sortTodos", given: { todos: dueSample, sort: "priority" } },
    { name: "sortTodos: due", op: "sortTodos", given: { todos: dueSample, sort: "due" } },
    { name: "sortTodos: defaults to priority", op: "sortTodos", given: { todos: dueSample } },
    {
      name: "addTodos prepends in draft order",
      op: "addTodos",
      given: { todos: sample, drafts: [{ title: "First" }, { title: "Second", priority: "high" }], now: T1 },
    },
    { name: "removeFromList removes several", op: "removeFromList", given: { todos: sample, ids: ["a", "c"] } },
    { name: "removeFromList ignores unknown ids", op: "removeFromList", given: { todos: sample, ids: ["zzz"] } },
    { name: "clearCompletedInList", op: "clearCompletedInList", given: { todos: sample } },
    { name: "countCompleted", op: "countCompleted", given: { todos: sample } },
    { name: "countCompleted empty", op: "countCompleted", given: { todos: [] } },
    {
      name: "bulkToggle completes a mixed selection",
      op: "bulkToggle",
      given: { todos: sample, ids: ["a", "b"], now: T1 },
    },
    {
      name: "bulkToggle reopens an all-complete selection",
      op: "bulkToggle",
      given: { todos: sample, ids: ["b"], now: T1 },
    },
    { name: "bulkToggle ignores unknown ids", op: "bulkToggle", given: { todos: sample, ids: ["zzz"], now: T1 } },
    { name: "bulkToggle with empty selection", op: "bulkToggle", given: { todos: sample, ids: [], now: T1 } },
  ],
};

export const ops: Ops = {
  filterTodos: (g) => filterTodos(g.todos, g.filter as TodoFilter),
  searchTodos: (g) => searchTodos(g.todos, g.query),
  sortByPriority: (g) => sortByPriority(g.todos),
  sortByDue: (g) => sortByDue(g.todos),
  sortTodos: (g) => sortTodos(g.todos, g.sort as TodoSort | undefined),
  countRemaining: (g) => countRemaining(g.todos),
  countCompleted: (g) => countCompleted(g.todos),
  addTodos: (g) => addTodos(g.todos, g.drafts, new Date(g.now)),
  toggleInList: (g) => toggleInList(g.todos, g.id, new Date(g.now)),
  removeFromList: (g) => removeFromList(g.todos, g.ids),
  clearCompletedInList: (g) => clearCompletedInList(g.todos),
  bulkToggle: (g) => bulkToggle(g.todos, g.ids, new Date(g.now)),
};
