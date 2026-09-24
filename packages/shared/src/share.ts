import type { Todo, TodoDraft } from "./types";
import { isValidTitle } from "./todos";

const MAX_SHARED_ITEMS = 50;

/**
 * Turns text shared from another app (or a `?add=` param) into drafts:
 * one per non-empty line, trimmed, de-duplicated against each other and
 * against existing todo titles (case-insensitive).
 */
export function draftsFromSharedText(
  texts: readonly string[],
  existing: readonly Pick<Todo, "title">[] = [],
): TodoDraft[] {
  const seen = new Set(existing.map((todo) => todo.title.trim().toLowerCase()));
  const drafts: TodoDraft[] = [];
  for (const text of texts) {
    for (const line of text.split(/\r?\n/)) {
      const title = line.replace(/\s+/g, " ").trim();
      const key = title.toLowerCase();
      if (!isValidTitle(title) || seen.has(key)) continue;
      seen.add(key);
      drafts.push({ title });
      if (drafts.length >= MAX_SHARED_ITEMS) return drafts;
    }
  }
  return drafts;
}

/** Text values from `?add=` (repeatable), plus `text`/`title` used by share-target URLs. */
export function sharedTextFromQuery(search: string): string[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return ["add", "text", "title"].flatMap((key) => params.getAll(key));
}

/** Removes the quick-add params so a reload does not re-add the same todos. */
export function stripShareParams(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of ["add", "text", "title"]) params.delete(key);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
