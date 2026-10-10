import { isValidDueDate } from "./todos";
import type { Todo, TodoPriority } from "./types";

export const EXPORT_VERSION = 1;
export type ImportMode = "merge" | "replace";
export const IMPORT_MODES: ImportMode[] = ["merge", "replace"];

export type TodoExport = { version: number; exportedAt: string; todos: Todo[] };
export type ImportResult = { todos: Todo[]; errors: string[] };

const CSV_COLUMNS = ["id", "title", "completed", "priority", "dueDate", "notes", "createdAt", "updatedAt"] as const;
const PRIORITIES: readonly TodoPriority[] = ["low", "medium", "high"];

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

export function exportFileName(format: "json" | "csv", now: Date = new Date()): string {
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
  if (typeof title !== "string" || !title.trim()) return { error: `${at} (${id}): missing title` };
  if (typeof completed !== "boolean") return { error: `${at} (${id}): completed must be true/false` };
  if (!PRIORITIES.includes(priority as TodoPriority))
    return { error: `${at} (${id}): priority must be low, medium, or high` };
  if (dueDate !== undefined && (typeof dueDate !== "string" || !isValidDueDate(dueDate)))
    return { error: `${at} (${id}): dueDate must be YYYY-MM-DD` };
  if (notes !== undefined && typeof notes !== "string") return { error: `${at} (${id}): notes must be text` };
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt)))
    return { error: `${at} (${id}): invalid createdAt` };
  const updated = typeof updatedAt === "string" && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : createdAt;
  return {
    todo: {
      id,
      title: title.trim(),
      completed,
      priority: priority as TodoPriority,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      createdAt,
      updatedAt: updated,
    },
  };
}

/** Accepts either the `{ version, todos }` export envelope or a bare todo array. */
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
    if (error) errors.push(error);
    else if (todo) {
      if (seen.has(todo.id)) errors.push(`Item ${index + 1} (${todo.id}): duplicate id`);
      else {
        seen.add(todo.id);
        todos.push(todo);
      }
    }
  });
  return { todos, errors };
}

/** merge: imported rows overwrite same-id rows, new ones are appended. replace: imported list wins. */
export function applyImport(existing: readonly Todo[], imported: readonly Todo[], mode: ImportMode): Todo[] {
  if (mode === "replace") return [...imported];
  const byId = new Map(imported.map((todo) => [todo.id, todo]));
  const merged = existing.map((todo) => byId.get(todo.id) ?? todo);
  const known = new Set(existing.map((todo) => todo.id));
  return [...merged, ...imported.filter((todo) => !known.has(todo.id))];
}
