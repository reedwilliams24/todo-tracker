import type { TodoDraft, TodoPriority } from "./types";
import { isValidTitle } from "./todos";

/** Limits shared by the clients (which downscale before upload) and the `/api/image-todos` route. */
export const IMAGE_IMPORT = {
  /** Types the route forwards to the model. Clients re-encode to JPEG, so this is mostly for direct callers. */
  acceptedTypes: ["image/heic", "image/heif", "image/jpeg", "image/png", "image/webp"],
  /** Decoded bytes; base64 adds a third, which keeps the request under Vercel's 4.5 MB body limit. */
  maxBytes: 3_000_000,
  /** Clients scale the longer edge down to this many pixels. */
  maxDimension: 2048,
  jpegQuality: 0.85,
  maxTodos: 50,
} as const;

export type ImageImportError = "busy" | "failed" | "invalid" | "offline" | "tooLarge" | "unavailable" | "unsupported";

const ERROR_CODES: readonly ImageImportError[] = [
  "busy",
  "failed",
  "invalid",
  "offline",
  "tooLarge",
  "unavailable",
  "unsupported",
];

/** Validates an image before it is sent (clients) or forwarded to the model (route). */
export function checkImageUpload(mimeType: string, bytes: number): "ok" | "invalid" | "tooLarge" | "unsupported" {
  if (!(IMAGE_IMPORT.acceptedTypes as readonly string[]).includes(mimeType.toLowerCase())) return "unsupported";
  if (bytes <= 0) return "invalid";
  if (bytes > IMAGE_IMPORT.maxBytes) return "tooLarge";
  return "ok";
}

/** Maps a failed `/api/image-todos` response to the error the client shows. */
export function imageImportErrorFor(status: number, body: unknown): ImageImportError {
  const code = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  if (typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code)) return code as ImageImportError;
  if (status === 400) return "invalid";
  if (status === 413) return "tooLarge";
  if (status === 415) return "unsupported";
  if (status === 429) return "busy";
  if (status === 503) return "unavailable";
  return "failed";
}

const BULLET = /^(?:[-*•◦▪·]|\[ ?\]|☐|\d{1,3}[.)])\s+/u;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isPriority(value: unknown): value is TodoPriority {
  return value === "low" || value === "medium" || value === "high";
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= days;
}

/**
 * Validates untrusted model output for an image into drafts: keeps the model's wording, strips list
 * bullets, drops invalid fields and duplicate titles, and caps the count.
 */
export function coerceImageDrafts(value: unknown): TodoDraft[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { todos?: unknown }).todos)
      ? (value as { todos: unknown[] }).todos
      : [];

  const drafts: TodoDraft[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (drafts.length >= IMAGE_IMPORT.maxTodos) break;
    const raw = typeof item === "string" ? { title: item } : item;
    if (typeof raw !== "object" || raw === null) continue;
    const { title, notes, priority, dueDate } = raw as Record<string, unknown>;
    if (typeof title !== "string") continue;
    const cleaned = collapse(collapse(title).replace(BULLET, ""));
    if (!isValidTitle(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const note = typeof notes === "string" ? notes.trim() : "";
    drafts.push({
      title: cleaned,
      notes: note && note.toLowerCase() !== key ? note : undefined,
      priority: isPriority(priority) ? priority : undefined,
      dueDate: isCalendarDate(dueDate) ? dueDate : undefined,
    });
  }
  return drafts;
}
