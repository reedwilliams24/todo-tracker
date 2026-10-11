import type { Todo } from "web/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Case = { name: string; op: string; given: Record<string, any> };
export type Feature = { feature: string; spec: string; cases: Case[] };

const T0 = "2026-01-05T09:00:00.000Z";
const T1 = "2026-01-05T10:00:00.000Z";
const T2 = "2026-01-05T11:00:00.000Z";

function todo(id: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    title: overrides.title ?? `Todo ${id}`,
    completed: false,
    priority: "medium",
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

const sample = [
  todo("a", { title: "Buy milk", notes: "2% organic", priority: "high", createdAt: "2026-01-01T09:00:00.000Z" }),
  todo("b", { title: "Walk the dog", completed: true, createdAt: "2026-01-02T09:00:00.000Z" }),
  todo("c", { title: "Call mom", priority: "low", dueDate: "2026-01-06", createdAt: "2026-01-03T09:00:00.000Z" }),
];

export const FEATURES: Feature[] = [
  {
    feature: "todo",
    spec: "features/todo.md",
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
      { name: "createTodo drops blank notes", op: "createTodo", given: { draft: { title: "Read", notes: "   " }, now: T0 } },
      { name: "toggleTodo completes", op: "toggleTodo", given: { todo: todo("a"), now: T1 } },
      { name: "toggleTodo reopens", op: "toggleTodo", given: { todo: todo("a", { completed: true }), now: T1 } },
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
    ],
  },
  {
    feature: "list",
    spec: "features/list.md",
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
        name: "addTodos prepends in draft order",
        op: "addTodos",
        given: { todos: sample, drafts: [{ title: "First" }, { title: "Second", priority: "high" }], now: T1 },
      },
      { name: "removeFromList removes several", op: "removeFromList", given: { todos: sample, ids: ["a", "c"] } },
      { name: "removeFromList ignores unknown ids", op: "removeFromList", given: { todos: sample, ids: ["zzz"] } },
      { name: "clearCompletedInList", op: "clearCompletedInList", given: { todos: sample } },
    ],
  },
  {
    feature: "undo",
    spec: "features/undo.md",
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
    ],
  },
  {
    feature: "storage",
    spec: "features/storage.md",
    cases: [
      { name: "parse valid list", op: "parseStoredTodos", given: { raw: JSON.stringify(sample) } },
      { name: "parse null", op: "parseStoredTodos", given: { raw: null } },
      { name: "parse empty string", op: "parseStoredTodos", given: { raw: "" } },
      { name: "parse corrupt JSON", op: "parseStoredTodos", given: { raw: "[{oops" } },
      { name: "parse non-array JSON", op: "parseStoredTodos", given: { raw: '{"id":"a"}' } },
      { name: "serialize round-trips", op: "serializeTodos", given: { todos: sample } },
    ],
  },
  {
    feature: "voice",
    spec: "features/voice.md",
    cases: [
      ...[
        "high priority call the bank",
        "pay rent urgent",
        "water plants low priority",
        "this is important email the landlord",
        "buy milk",
        "low key email bob",
      ].map((text) => ({ name: `extractPriority: ${text}`, op: "extractPriority", given: { text } })),
      // Monday 2026-01-05, local time.
      ...[
        "call mom today",
        "finish report tonight",
        "dentist tomorrow",
        "plan trip next week",
        "gym on friday",
        "standup monday",
        "meet sam next monday",
        "renew passport",
      ].map((text) => ({
        name: `extractDueDate: ${text}`,
        op: "extractDueDate",
        given: { text, now: "2026-01-05T09:00:00" },
      })),
      ...["um I need to buy milk.", "  remind me to call the bank  ", "Please, uh, water the plants!", "add a todo to pay rent"].map(
        (text) => ({ name: `cleanTitle: ${text.trim()}`, op: "cleanTitle", given: { text } }),
      ),
      ...[
        "buy milk and call mom tomorrow, then high priority pay rent",
        "I need to email Bob. Also water plants on friday",
        "um",
        "",
      ].map((transcript) => ({
        name: `parseTranscript: ${transcript || "(empty)"}`,
        op: "parseTranscript",
        given: { transcript, now: "2026-01-05T09:00:00" },
      })),
      {
        name: "coerceDrafts accepts model output and drops junk",
        op: "coerceDrafts",
        given: {
          value: {
            todos: [
              { title: " Buy milk ", priority: "HIGH", dueDate: "2026-01-06" },
              { title: "", priority: "low" },
              { title: "Call mom", priority: "urgent", dueDate: "next week" },
              "nope",
            ],
          },
        },
      },
      { name: "coerceDrafts accepts a bare array", op: "coerceDrafts", given: { value: [{ title: "Read" }] } },
      { name: "coerceDrafts rejects non-objects", op: "coerceDrafts", given: { value: "buy milk" } },
      {
        name: "reconcileDrafts replaces a heuristic draft with the matching llm draft",
        op: "reconcileDrafts",
        given: {
          heuristic: [{ title: "buy milk", priority: "high", dueDate: "2026-01-06" }],
          llm: [{ title: "Buy milk" }],
        },
      },
      { name: "reconcileDrafts falls back to heuristic", op: "reconcileDrafts", given: { heuristic: [{ title: "buy milk" }], llm: [] } },
    ],
  },
  {
    feature: "transfer",
    spec: "features/transfer.md",
    cases: [
      { name: "exportTodosJson wraps the list in a versioned envelope", op: "exportTodosJson", given: { todos: sample, now: T1 } },
      { name: "exportTodosJson with no todos", op: "exportTodosJson", given: { todos: [], now: T1 } },
      {
        name: "exportTodosCsv writes a header and quotes cells with quotes, commas and newlines",
        op: "exportTodosCsv",
        given: {
          todos: [
            ...sample,
            todo("q", { title: 'Say "hi", then leave', notes: "line1\nline2", completed: true, priority: "low" }),
          ],
        },
      },
      { name: "exportTodosCsv with no todos is just the header", op: "exportTodosCsv", given: { todos: [] } },
      { name: "exportFileName json", op: "exportFileName", given: { format: "json", now: T1 } },
      { name: "exportFileName uses the UTC date", op: "exportFileName", given: { format: "csv", now: "2026-01-05T23:30:00.000Z" } },
      ...[
        ["with milliseconds", "2026-01-05T09:00:00.000Z"],
        ["without milliseconds", "2026-01-05T09:00:00Z"],
        ["one fraction digit", "2026-01-05T09:00:00.5Z"],
        ["no Z", "2026-01-05T09:00:00.000"],
        ["offset", "2026-01-05T09:00:00+01:00"],
        ["date only", "2026-01-05"],
        ["not a real date", "2026-02-30T09:00:00.000Z"],
        ["hour 24", "2026-01-05T24:00:00.000Z"],
        ["garbage", "yesterday"],
      ].map(([label, value]) => ({ name: `isValidTimestamp: ${label}`, op: "isValidTimestamp", given: { value } })),
      {
        name: "parseImportJson reads the export envelope",
        op: "parseImportJson",
        given: { json: { version: 1, exportedAt: T1, todos: sample } },
      },
      { name: "parseImportJson accepts a bare array", op: "parseImportJson", given: { json: sample } },
      {
        name: "parseImportJson trims titles, drops empty or null optional fields and defaults updatedAt",
        op: "parseImportJson",
        given: {
          json: [
            { id: "t1", title: "  Padded  ", completed: false, priority: "low", dueDate: "", notes: "", createdAt: T0 },
            { id: "t2", title: "Nulls", completed: true, priority: "high", dueDate: null, notes: null, createdAt: T0, updatedAt: null },
            { id: "t3", title: "Bad updatedAt", completed: false, priority: "medium", createdAt: T0, updatedAt: "later" },
            { id: "t4", title: "Extra keys", completed: false, priority: "medium", createdAt: T0, updatedAt: T1, tags: ["x"] },
          ],
        },
      },
      {
        name: "parseImportJson reports each invalid item and keeps the valid ones",
        op: "parseImportJson",
        given: {
          json: [
            todo("ok", { title: "Valid" }),
            "nope",
            [1, 2],
            { title: "No id", completed: false, priority: "low", createdAt: T0 },
            { ...todo("num"), id: 7 },
            todo("blank", { title: "   " }),
            todo("long", { title: "x".repeat(201) }),
            { ...todo("yes"), completed: "yes" },
            { ...todo("urgent"), priority: "urgent" },
            todo("date", { dueDate: "2026-02-30" }),
            { ...todo("notes"), notes: 5 },
            { ...todo("created"), createdAt: "2026-01-05" },
            { ...todo("nocreated"), createdAt: undefined },
            todo("ok", { title: "Duplicate" }),
          ],
        },
      },
      { name: "parseImportJson rejects invalid JSON", op: "parseImportJson", given: { raw: "{oops" } },
      { name: "parseImportJson rejects an empty file", op: "parseImportJson", given: { raw: "" } },
      { name: "parseImportJson rejects a non-list todos field", op: "parseImportJson", given: { raw: '{"todos": 3}' } },
      { name: "parseImportJson rejects an object without todos", op: "parseImportJson", given: { raw: '{"version": 1}' } },
      { name: "parseImportJson rejects a bare value", op: "parseImportJson", given: { raw: "42" } },
      { name: "parseImportJson with an empty list", op: "parseImportJson", given: { raw: "[]" } },
      {
        name: "applyImport merge overwrites same-id todos in place and appends new ones",
        op: "applyImport",
        given: {
          existing: sample,
          imported: [todo("n", { title: "New" }), todo("b", { title: "Walk the dog twice" })],
          mode: "merge",
        },
      },
      { name: "applyImport merge into an empty list", op: "applyImport", given: { existing: [], imported: sample, mode: "merge" } },
      {
        name: "applyImport replace keeps only the imported todos",
        op: "applyImport",
        given: { existing: sample, imported: [todo("n", { title: "New" })], mode: "replace" },
      },
      { name: "applyImport replace with nothing empties the list", op: "applyImport", given: { existing: sample, imported: [], mode: "replace" } },
      ...[
        [1, 0],
        [2, 0],
        [1, 1],
        [3, 2],
        [0, 1],
      ].map(([valid, problems]) => ({
        name: `describeImport: ${valid} valid, ${problems} problems`,
        op: "describeImport",
        given: { valid, problems },
      })),
      ...([
        [1, "merge"],
        [3, "replace"],
        [0, "merge"],
      ] as const).map(([count, mode]) => ({ name: `describeImported: ${count} ${mode}`, op: "describeImported", given: { count, mode } })),
      {
        name: "importing clears a pending undo",
        op: "applyActions",
        given: {
          todos: sample,
          steps: [
            { action: "remove", ids: ["a"], now: T1 },
            { action: "import", todos: [todo("n", { title: "New" })], mode: "merge", now: T2 },
          ],
        },
      },
      {
        name: "import replace through the reducer",
        op: "applyActions",
        given: { todos: sample, steps: [{ action: "import", todos: [todo("n", { title: "New" })], mode: "replace", now: T1 }] },
      },
    ],
  },
];
