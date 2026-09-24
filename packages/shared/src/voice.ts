import type { TodoDraft, TodoPriority } from "./types";
import { isValidTitle } from "./todos";

const SEPARATOR = /\s*(?:\band then\b|\bafter that\b|\balso\b|\band also\b|[;\n]|,\s*(?=and\s)|\.\s+)\s*/i;

const PRIORITY_PATTERNS: ReadonlyArray<readonly [RegExp, TodoPriority]> = [
  [/\b(urgent(ly)?|asap|critical|high priority|important)\b/i, "high"],
  [/\b(low priority|whenever|no rush|someday|eventually)\b/i, "low"],
  [/\b(medium priority|normal priority)\b/i, "medium"],
];

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const LEADING_FILLER =
  /^(?:(?:um|uh|ok|okay|so|hey|please|remind me to|i need to|i have to|i want to|remember to|add (?:a )?(?:todo|task|item)(?: to| for)?|create (?:a )?(?:todo|task)(?: to| for)?|make (?:a )?note to|let's|lets)(?:\s+|$))+/i;

const LEADING_PUNCTUATION = /^[\s.,!?]+/;

const TRAILING_FILLER = /[\s.,!?]+$/;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function extractPriority(text: string): { priority?: TodoPriority; rest: string } {
  for (const [pattern, priority] of PRIORITY_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      return { priority, rest: text.replace(pattern, " ") };
    }
  }
  return { rest: text };
}

export function extractDueDate(text: string, now: Date = new Date()): { dueDate?: string; rest: string } {
  const today = /\btoday\b/i;
  const tonight = /\btonight\b/i;
  const tomorrow = /\btomorrow\b/i;
  const nextWeek = /\bnext week\b/i;

  if (today.test(text)) return { dueDate: toIsoDate(now), rest: text.replace(today, " ") };
  if (tonight.test(text)) return { dueDate: toIsoDate(now), rest: text.replace(tonight, " ") };
  if (tomorrow.test(text)) return { dueDate: toIsoDate(addDays(now, 1)), rest: text.replace(tomorrow, " ") };
  if (nextWeek.test(text)) return { dueDate: toIsoDate(addDays(now, 7)), rest: text.replace(nextWeek, " ") };

  for (const [index, weekday] of WEEKDAYS.entries()) {
    const pattern = new RegExp(`\\b(?:on|by|next)?\\s*${weekday}\\b`, "i");
    if (pattern.test(text)) {
      const delta = (index - now.getDay() + 7) % 7 || 7;
      return { dueDate: toIsoDate(addDays(now, delta)), rest: text.replace(pattern, " ") };
    }
  }

  return { rest: text };
}

export function cleanTitle(text: string): string {
  return text
    .replace(LEADING_PUNCTUATION, "")
    .replace(LEADING_FILLER, "")
    .replace(/\s+/g, " ")
    .replace(TRAILING_FILLER, "")
    .trim();
}

/**
 * Splits a spoken transcript into todo drafts without an LLM. Used as a
 * fallback when the model is unavailable and to sanity-check model output.
 */
export function parseTranscript(transcript: string, now: Date = new Date()): TodoDraft[] {
  return transcript
    .split(SEPARATOR)
    .map((segment) => {
      const withoutPriority = extractPriority(segment);
      const withoutDueDate = extractDueDate(withoutPriority.rest, now);
      const title = cleanTitle(withoutDueDate.rest);
      return {
        title,
        priority: withoutPriority.priority,
        dueDate: withoutDueDate.dueDate,
      } satisfies TodoDraft;
    })
    .filter((draft) => isValidTitle(draft.title));
}

function isPriority(value: unknown): value is TodoPriority {
  return value === "low" || value === "medium" || value === "high";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Validates untrusted model output into drafts, dropping anything malformed.
 */
export function coerceDrafts(value: unknown): TodoDraft[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { todos?: unknown }).todos)
      ? (value as { todos: unknown[] }).todos
      : [];

  const drafts: TodoDraft[] = [];
  for (const item of items) {
    const raw = typeof item === "string" ? { title: item } : item;
    if (typeof raw !== "object" || raw === null) continue;
    const { title, priority, dueDate } = raw as Record<string, unknown>;
    if (typeof title !== "string") continue;
    const cleaned = cleanTitle(title);
    if (!isValidTitle(cleaned)) continue;
    drafts.push({
      title: cleaned,
      priority: isPriority(priority) ? priority : undefined,
      dueDate: isIsoDate(dueDate) ? dueDate : undefined,
    });
  }
  return drafts;
}
