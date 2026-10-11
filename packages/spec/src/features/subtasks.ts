import { addSubtask, removeSubtask, subtaskProgress, toggleSubtask, type Todo } from "web/domain";
import { T1, T2, todo } from "../helpers";
import type { Case, Feature, Ops } from "../types";

function cases(): Case[] {
  const open = todo("p", {
    title: "Plan trip",
    subtasks: [
      { id: "s1", title: "Book flight", completed: true },
      { id: "s2", title: "Book hotel", completed: false },
    ],
  });
  const done = todo("q", {
    title: "Pack",
    completed: true,
    subtasks: [
      { id: "s3", title: "Clothes", completed: true },
      { id: "s4", title: "Charger", completed: true },
    ],
  });
  const plain = todo("r", { title: "Plain" });
  const recurring = todo("w", {
    title: "Water plants",
    recurrence: "weekly",
    dueDate: "2026-01-05",
    subtasks: [{ id: "s6", title: "Fill can", completed: false }],
  });
  return [
    { name: "subtaskProgress: none", op: "subtaskProgress", given: { todo: plain } },
    { name: "subtaskProgress: some done", op: "subtaskProgress", given: { todo: open } },
    { name: "subtaskProgress: all done", op: "subtaskProgress", given: { todo: done } },
    {
      name: "addSubtask: first trims title",
      op: "addSubtask",
      given: { todo: plain, title: "  Book flight ", now: T1 },
    },
    { name: "addSubtask: appends after existing", op: "addSubtask", given: { todo: open, title: "Rent car", now: T1 } },
    {
      name: "addSubtask: to completed parent keeps it completed",
      op: "addSubtask",
      given: { todo: done, title: "Passport", now: T1 },
    },
    { name: "addSubtask: blank title is ignored", op: "addSubtask", given: { todo: open, title: "   ", now: T1 } },
    {
      name: "addSubtask: 201 chars is ignored",
      op: "addSubtask",
      given: { todo: open, title: "x".repeat(201), now: T1 },
    },
    {
      name: "toggleSubtask: completing the last open one completes the parent",
      op: "toggleSubtask",
      given: { todo: open, subtaskId: "s2", now: T1 },
    },
    {
      name: "toggleSubtask: unchecking one keeps parent open",
      op: "toggleSubtask",
      given: { todo: open, subtaskId: "s1", now: T1 },
    },
    {
      name: "toggleSubtask: unchecking one reopens a completed parent",
      op: "toggleSubtask",
      given: { todo: done, subtaskId: "s3", now: T1 },
    },
    {
      name: "toggleSubtask: unknown id is ignored",
      op: "toggleSubtask",
      given: { todo: open, subtaskId: "nope", now: T1 },
    },
    {
      name: "removeSubtask: keeps parent completion",
      op: "removeSubtask",
      given: { todo: open, subtaskId: "s2", now: T1 },
    },
    {
      name: "removeSubtask: removing the last drops the list",
      op: "removeSubtask",
      given: {
        todo: todo("t", { subtasks: [{ id: "s5", title: "Only", completed: false }] }),
        subtaskId: "s5",
        now: T1,
      },
    },
    {
      name: "removeSubtask: unknown id is ignored",
      op: "removeSubtask",
      given: { todo: open, subtaskId: "nope", now: T1 },
    },
    {
      name: "list: add, toggle and remove through the reducer",
      op: "applyActions",
      given: {
        todos: [plain, open],
        steps: [
          { action: "addSubtask", id: "r", title: "Step one", now: T1 },
          { action: "toggleSubtask", id: "p", subtaskId: "s1", now: T1 },
          { action: "removeSubtask", id: "p", subtaskId: "s2", now: T2 },
        ],
      },
    },
    {
      name: "list: completing the parent via its last subtask offers undo",
      op: "applyActions",
      given: { todos: [plain, open], steps: [{ action: "toggleSubtask", id: "p", subtaskId: "s2", now: T1 }] },
    },
    {
      name: "list: undo restores the parent and its subtasks",
      op: "applyActions",
      given: {
        todos: [plain, open],
        steps: [
          { action: "toggleSubtask", id: "p", subtaskId: "s2", now: T1 },
          { action: "undo", now: T2 },
        ],
      },
    },
    {
      name: "list: reopening via a subtask does not offer undo",
      op: "applyActions",
      given: { todos: [done], steps: [{ action: "toggleSubtask", id: "q", subtaskId: "s3", now: T1 }] },
    },
    {
      name: "list: unknown todo id is ignored",
      op: "applyActions",
      given: { todos: [open], steps: [{ action: "addSubtask", id: "zzz", title: "x", now: T1 }] },
    },
    {
      name: "list: completing a recurring parent via its last subtask schedules the next occurrence",
      op: "applyActions",
      given: { todos: [recurring], steps: [{ action: "toggleSubtask", id: "w", subtaskId: "s6", now: T1 }] },
    },
    { name: "storage: subtasks round-trip", op: "serializeTodos", given: { todos: [open, done] } },
    { name: "storage: parse keeps subtasks", op: "parseStoredTodos", given: { raw: JSON.stringify([open]) } },
  ];
}

export const feature: Feature = {
  feature: "subtasks",
  spec: "features/subtasks.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: cases(),
};

export const ops: Ops = {
  subtaskProgress: (g) => subtaskProgress(g.todo as Todo),
  addSubtask: (g) => addSubtask(g.todo as Todo, g.title, new Date(g.now)),
  toggleSubtask: (g) => toggleSubtask(g.todo as Todo, g.subtaskId, new Date(g.now)),
  removeSubtask: (g) => removeSubtask(g.todo as Todo, g.subtaskId, new Date(g.now)),
};
