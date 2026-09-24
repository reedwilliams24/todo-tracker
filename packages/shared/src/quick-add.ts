import type { TodoDraft, TodoPriority } from "./types";
import { cleanTitle, extractDueDate, extractPriority } from "./voice";

export type QuickAddParse = {
  title: string;
  priority?: TodoPriority;
  dueDate?: string;
  tags: string[];
};

const TAG = /(^|\s)#([\p{L}\p{N}_-]+)/gu;
const BANG_PRIORITY = /(^|\s)!(p[123]|high|med(?:ium)?|low)\b/i;
const ISO_DATE = /(^|\s)(?:on |by |due )?(\d{4}-\d{2}-\d{2})\b/i;
const IN_DAYS = /\bin (\d{1,3}) days?\b/i;

const BANG_MAP: Record<string, TodoPriority> = {
  p1: "high",
  p2: "medium",
  p3: "low",
  high: "high",
  med: "medium",
  medium: "medium",
  low: "low",
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses quick-add shorthand such as `call mom tomorrow 5pm #family !p1`
 * into a draft: `#tag` -> tags, `!p1`/`!high` -> priority, natural dates
 * (today, tomorrow, friday, next week, in 3 days, YYYY-MM-DD) -> dueDate.
 * Times like `5pm` stay in the title since todos carry a date only.
 */
export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddParse {
  let rest = input;
  const tags: string[] = [];
  rest = rest.replace(TAG, (_, lead: string, tag: string) => {
    const lower = tag.toLowerCase();
    if (!tags.includes(lower)) tags.push(lower);
    return lead;
  });

  let priority: TodoPriority | undefined;
  const bang = BANG_PRIORITY.exec(rest);
  if (bang) {
    priority = BANG_MAP[bang[2]!.toLowerCase()];
    rest = rest.replace(BANG_PRIORITY, " ");
  } else {
    const spoken = extractPriority(rest);
    priority = spoken.priority;
    rest = spoken.rest;
  }

  let dueDate: string | undefined;
  const iso = ISO_DATE.exec(rest);
  const inDays = IN_DAYS.exec(rest);
  if (iso) {
    dueDate = iso[2];
    rest = rest.replace(ISO_DATE, " ");
  } else if (inDays) {
    const next = new Date(now);
    next.setDate(next.getDate() + Number(inDays[1]));
    dueDate = toIsoDate(next);
    rest = rest.replace(IN_DAYS, " ");
  } else {
    const spoken = extractDueDate(rest, now);
    dueDate = spoken.dueDate;
    rest = spoken.rest;
  }

  return { title: cleanTitle(rest), priority, dueDate, tags };
}

/** True when the input contains any shorthand worth previewing. */
export function hasQuickAddMeta(parse: QuickAddParse): boolean {
  return parse.priority !== undefined || parse.dueDate !== undefined || parse.tags.length > 0;
}

export function quickAddToDraft(parse: QuickAddParse, fallbackPriority: TodoPriority, fallbackDueDate?: string): TodoDraft {
  return {
    title: parse.title,
    priority: parse.priority ?? fallbackPriority,
    dueDate: parse.dueDate ?? (fallbackDueDate || undefined),
  };
}
