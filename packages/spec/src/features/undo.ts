import {
  addTodos,
  describeUndo,
  INITIAL_TODO_STATE,
  isUndoExpired,
  reduceTodos,
  type Todo,
  type TodoAction,
  type TodoDraft,
  type TodoState,
} from "web/domain";
import { T0, T1, T2, sample } from "../helpers";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "undo",
  spec: "features/undo.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    ...([
      ["complete", 1],
      ["complete", 3],
      ["delete", 1],
      ["delete", 2],
    ] as const).map(([action, count]) => ({
      name: `describeUndo: ${action} ${count}`,
      op: "describeUndo",
      given: { action, count },
    })),
    ...[
      ["just created", "2026-01-05T09:00:00.000Z"],
      ["4999ms later", "2026-01-05T09:00:04.999Z"],
      ["exactly 5000ms later", "2026-01-05T09:00:05.000Z"],
      ["after timeout", "2026-01-05T09:00:06.000Z"],
    ].map(([label, now]) => ({ name: `isUndoExpired: ${label}`, op: "isUndoExpired", given: { at: T0, now } })),
    {
      name: "completing offers undo that restores the list",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "toggle", id: "a", now: T1 }, { action: "undo", now: T2 }] },
    },
    {
      name: "completing sets undo label",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "toggle", id: "a", now: T1 }] },
    },
    {
      name: "reopening a completed todo does not offer undo",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "toggle", id: "b", now: T1 }] },
    },
    {
      name: "bulk complete offers undo counting newly completed todos",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "toggleMany", ids: ["a", "b", "c"], now: T1 }] },
    },
    {
      name: "undo restores a bulk complete",
      op: "applyActions",
      given: {
        todos: sample,
        steps: [
          { action: "toggleMany", ids: ["a", "c"], now: T1 },
          { action: "undo", now: T2 },
        ],
      },
    },
    {
      name: "bulk reopen does not offer undo",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "toggleMany", ids: ["b"], now: T1 }] },
    },
    {
      name: "bulk toggle of unknown ids changes nothing",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "toggleMany", ids: ["zzz"], now: T1 }] },
    },
    {
      name: "deleting one offers undo",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "remove", ids: ["c"], now: T1 }] },
    },
    {
      name: "undo restores deleted todo at its original position",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "remove", ids: ["a"], now: T1 }, { action: "undo", now: T2 }] },
    },
    {
      name: "deleting several",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "remove", ids: ["a", "b"], now: T1 }] },
    },
    {
      name: "deleting nothing leaves no undo",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "remove", ids: ["zzz"], now: T1 }] },
    },
    {
      name: "clear completed offers undo",
      op: "applyActions",
      given: { todos: sample, steps: [{ action: "clearCompleted", now: T1 }, { action: "undo", now: T2 }] },
    },
    {
      name: "clear completed with nothing completed leaves no undo",
      op: "applyActions",
      given: { todos: [sample[0]], steps: [{ action: "clearCompleted", now: T1 }] },
    },
    {
      name: "only the latest action can be undone",
      op: "applyActions",
      given: {
        todos: sample,
        steps: [
          { action: "remove", ids: ["a"], now: T1 },
          { action: "toggle", id: "c", now: T1 },
          { action: "undo", now: T2 },
        ],
      },
    },
    {
      name: "undo twice is a no-op the second time",
      op: "applyActions",
      given: {
        todos: sample,
        steps: [
          { action: "remove", ids: ["a"], now: T1 },
          { action: "undo", now: T1 },
          { action: "undo", now: T2 },
        ],
      },
    },
    {
      name: "undo is dropped once it expires",
      op: "applyActions",
      given: {
        todos: sample,
        steps: [
          { action: "remove", ids: ["a"], now: "2026-01-05T10:00:00.000Z" },
          { action: "expireUndo", now: "2026-01-05T10:00:05.000Z" },
          { action: "undo", now: "2026-01-05T10:00:06.000Z" },
        ],
      },
    },
    {
      name: "expiry before the timeout keeps undo",
      op: "applyActions",
      given: {
        todos: sample,
        steps: [
          { action: "remove", ids: ["a"], now: "2026-01-05T10:00:00.000Z" },
          { action: "expireUndo", now: "2026-01-05T10:00:04.000Z" },
        ],
      },
    },
    {
      name: "renaming keeps the previous undo",
      op: "applyActions",
      given: {
        todos: sample,
        steps: [
          { action: "remove", ids: ["c"], now: T1 },
          { action: "rename", id: "a", title: "Buy oat milk", now: T1 },
        ],
      },
    },
    {
      name: "adding prepends and keeps undo",
      op: "applyActions",
      given: {
        todos: sample,
        steps: [
          { action: "remove", ids: ["c"], now: T1 },
          { action: "add", drafts: [{ title: "New one", priority: "high" }], now: T1 },
        ],
      },
    },
      {
        name: "reordering keeps the previous undo",
        op: "applyActions",
        given: {
          todos: sample,
          steps: [
            { action: "toggle", id: "a", now: T1 },
            { action: "reorder", visibleIds: ["a", "b", "c"], id: "c", targetId: "a", now: T1 },
          ],
        },
      },
      {
        name: "undo after reordering restores the order before the undoable action",
        op: "applyActions",
        given: {
          todos: sample,
          steps: [
            { action: "remove", ids: ["b"], now: T1 },
            { action: "reorder", visibleIds: ["a", "c"], id: "c", targetId: "a", now: T1 },
            { action: "undo", now: T2 },
          ],
        },
      },
  ],
};

type Step =
  | { action: "add"; drafts: TodoDraft[]; now: string }
  | { action: "toggle"; id: string; now: string }
  | { action: "toggleMany"; ids: string[]; now: string }
  | { action: "rename"; id: string; title: string; now: string }
  | { action: "remove"; ids: string[]; now: string }
  | { action: "clearCompleted"; now: string }
  | { action: "undo"; now: string }
  | { action: "expireUndo"; now: string };

function applyStep(state: TodoState, step: Step): TodoState {
  const now = new Date(step.now);
  if (step.action === "add") {
    const { created } = addTodos([], step.drafts, now);
    return reduceTodos(state, { type: "prepend", todos: created }, now);
  }
  const { action, now: _now, ...rest } = step;
  return reduceTodos(state, { type: action, ...rest } as TodoAction, now);
}

export const ops: Ops = {
  describeUndo: (g) => describeUndo(g.action, g.count),
  isUndoExpired: (g) =>
    isUndoExpired({ label: "", before: [], at: Date.parse(g.at) }, Date.parse(g.now), g.timeoutMs),
  applyActions: (g) => {
    let state: TodoState = { ...INITIAL_TODO_STATE, todos: g.todos as Todo[] };
    for (const step of g.steps as Step[]) state = applyStep(state, step);
    return { todos: state.todos, undoLabel: state.undoable?.label ?? null };
  },
};
