import {
  addTodos,
  cleanTitle,
  clearCompletedInList,
  coerceDrafts,
  countRemaining,
  createTodo,
  DEFAULT_PRIORITY,
  describeUndo,
  EMPTY_TODO_FORM,
  extractDueDate,
  extractPriority,
  filterTodos,
  INITIAL_TODO_STATE,
  isUndoExpired,
  isValidDueDate,
  isValidTitle,
  parseStoredTodos,
  parseTranscript,
  PRIORITY_ORDER,
  reconcileDrafts,
  reduceTodos,
  removeFromList,
  searchTodos,
  serializeTodos,
  sortByPriority,
  STORAGE_KEY,
  toggleTodo,
  toTodoDraft,
  UNDO_TIMEOUT_MS,
  updateTodoText,
  type Todo,
  type TodoAction,
  type TodoDraft,
  type TodoFilter,
  type TodoFormState,
  type TodoState,
} from "@todo/shared";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Given = Record<string, any>;

type Step =
  | { action: "add"; drafts: TodoDraft[]; now: string }
  | { action: "toggle"; id: string; now: string }
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

/** TypeScript implementation of every operation named in spec/fixtures. */
export const OPS: Record<string, (given: Given) => unknown> = {
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
  filterTodos: (g) => filterTodos(g.todos, g.filter as TodoFilter),
  searchTodos: (g) => searchTodos(g.todos, g.query),
  sortByPriority: (g) => sortByPriority(g.todos),
  countRemaining: (g) => countRemaining(g.todos),
  addTodos: (g) => addTodos(g.todos, g.drafts, new Date(g.now)),
  removeFromList: (g) => removeFromList(g.todos, g.ids),
  clearCompletedInList: (g) => clearCompletedInList(g.todos),
  describeUndo: (g) => describeUndo(g.action, g.count),
  isUndoExpired: (g) =>
    isUndoExpired({ label: "", before: [], at: Date.parse(g.at) }, Date.parse(g.now), g.timeoutMs),
  applyActions: (g) => {
    let state: TodoState = { ...INITIAL_TODO_STATE, todos: g.todos as Todo[] };
    for (const step of g.steps as Step[]) state = applyStep(state, step);
    return { todos: state.todos, undoLabel: state.undoable?.label ?? null };
  },
  parseStoredTodos: (g) => parseStoredTodos(g.raw),
  serializeTodos: (g) => JSON.parse(serializeTodos(g.todos)),
  parseTranscript: (g) => parseTranscript(g.transcript, new Date(g.now)),
  extractPriority: (g) => extractPriority(g.text),
  extractDueDate: (g) => extractDueDate(g.text, new Date(g.now)),
  cleanTitle: (g) => cleanTitle(g.text),
  coerceDrafts: (g) => coerceDrafts(g.value),
  reconcileDrafts: (g) => reconcileDrafts(g.heuristic, g.llm),
};

const NEW_ID = /^new-\d+$/;

function collectIds(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) value.forEach((item) => collectIds(item, into));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "id" && typeof child === "string") into.add(child);
      else collectIds(child, into);
    }
  }
}

/**
 * Makes an op result comparable across languages: drops undefined/null-valued
 * object keys (JSON round-trip) and renames ids that did not exist in `given`
 * to new-1, new-2, … in order of first appearance.
 */
export function normalize(given: Given, result: unknown): unknown {
  const known = new Set<string>();
  collectIds(given, known);
  const renamed = new Map<string, string>();
  const json = JSON.stringify(result ?? null, (key, value) => {
    if (key === "id" && typeof value === "string" && !known.has(value) && !NEW_ID.test(value)) {
      if (!renamed.has(value)) renamed.set(value, `new-${renamed.size + 1}`);
      return renamed.get(value);
    }
    return value;
  });
  return JSON.parse(json);
}

export function runOp(op: string, given: Given): unknown {
  const impl = OPS[op];
  if (!impl) throw new Error(`Unknown op "${op}"`);
  return normalize(given, impl(structuredClone(given)));
}
