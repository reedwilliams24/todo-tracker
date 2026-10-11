import { isValidDueDate, isValidTitle } from "./todos";
import type { Todo, TodoPriority } from "./types";

export const EXPORT_VERSION = 1;
export type ImportMode = "merge" | "replace";
export const IMPORT_MODES: ImportMode[] = ["merge", "replace"];
export type ExportFormat = "json" | "csv";

export type TodoExport = { version: number; exportedAt: string; todos: Todo[] };
export type ImportResult = { todos: Todo[]; errors: string[] };

export const CSV_COLUMNS = ["id", "title", "completed", "priority", "dueDate", "notes", "createdAt", "updatedAt"] as const;
const PRIORITIES: readonly TodoPriority[] = ["low", "medium", "high"];
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/;

/** UTC ISO-8601 like `2026-01-05T09:00:00.000Z` (milliseconds optional), with a real date and time. */
export function isValidTimestamp(value: string): boolean {
  const match = TIMESTAMP.exec(value);
  if (!match) return false;
  const [, date, hours, minutes, seconds] = match;
  return isValidDueDate(date!) && Number(hours) < 24 && Number(minutes) < 60 && Number(seconds) < 60;
}

export function exportTodosJson(todos: readonly Todo[], now: Date = new Date()): string {
  const payload: TodoExport = { version: EXPORT_VERSION, exportedAt: now.toISOString(), todos: [...todos] };
  return JSON.stringify(payload, null, 2);
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportTodosCsv(todos: readonly Todo[]): string {
  const rows = todos.map((todo) => CSV_COLUMNS.map((column) => csvCell(todo[column])).join(","));
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

/** `todos-YYYY-MM-DD.<format>`, dated in UTC. */
export function exportFileName(format: ExportFormat, now: Date = new Date()): string {
  return `todos-${now.toISOString().slice(0, 10)}.${format}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTodo(value: unknown, index: number): { todo?: Todo; error?: string } {
  const at = `Item ${index + 1}`;
  if (!isRecord(value)) return { error: `${at}: not an object` };
  const { id, title, completed, priority, dueDate, notes, createdAt, updatedAt } = value;
  if (typeof id !== "string" || !id) return { error: `${at}: missing id` };
  const fail = (problem: string) => ({ error: `${at} (${id}): ${problem}` });
  if (typeof title !== "string" || !isValidTitle(title)) return fail("title must be 1-200 characters");
  if (typeof completed !== "boolean") return fail("completed must be true/false");
  if (!PRIORITIES.includes(priority as TodoPriority)) return fail("priority must be low, medium, or high");
  if (dueDate != null && (typeof dueDate !== "string" || !isValidDueDate(dueDate))) return fail("dueDate must be YYYY-MM-DD");
  if (notes != null && typeof notes !== "string") return fail("notes must be text");
  if (typeof createdAt !== "string" || !isValidTimestamp(createdAt)) return fail("invalid createdAt");
  return {
    todo: {
      id,
      title: title.trim(),
      notes: notes || undefined,
      completed,
      priority: priority as TodoPriority,
      dueDate: dueDate || undefined,
      createdAt,
      updatedAt: typeof updatedAt === "string" && isValidTimestamp(updatedAt) ? updatedAt : createdAt,
    },
  };
}

/** Accepts the `{ version, todos }` export envelope or a bare todo array; keeps valid items and reports the rest. */
export function parseImportJson(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { todos: [], errors: ["File is not valid JSON"] };
  }
  const list = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.todos : undefined;
  if (!Array.isArray(list)) return { todos: [], errors: ["Expected a list of todos"] };

  const todos: Todo[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  list.forEach((item, index) => {
    const { todo, error } = validateTodo(item, index);
    if (!todo) errors.push(error!);
    else if (seen.has(todo.id)) errors.push(`Item ${index + 1} (${todo.id}): duplicate id`);
    else {
      seen.add(todo.id);
      todos.push(todo);
    }
  });
  return { todos, errors };
}

/** merge: imported rows overwrite same-id rows in place, new ones are appended. replace: the imported list wins. */
export function applyImport(existing: readonly Todo[], imported: readonly Todo[], mode: ImportMode): Todo[] {
  if (mode === "replace") return [...imported];
  const byId = new Map(imported.map((todo) => [todo.id, todo]));
  const merged = existing.map((todo) => byId.get(todo.id) ?? todo);
  const known = new Set(existing.map((todo) => todo.id));
  return [...merged, ...imported.filter((todo) => !known.has(todo.id))];
}

const plural = (count: number, noun: string) => `${count} ${count === 1 ? noun : `${noun}s`}`;

/** Confirmation text, e.g. "Found 1 valid todo and 2 problems." */
export function describeImport(valid: number, problems: number): string {
  return `Found ${valid} valid ${valid === 1 ? "todo" : "todos"}${problems > 0 ? ` and ${plural(problems, "problem")}` : ""}.`;
}

/** Status after confirming, e.g. "Imported 3 todos (merge)." */
export function describeImported(count: number, mode: ImportMode): string {
  return `Imported ${plural(count, "todo")} (${mode}).`;
}
