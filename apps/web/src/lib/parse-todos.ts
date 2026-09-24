import type { TodoDraft } from "@todo/shared";
import { coerceDrafts, parseTranscript } from "@todo/shared";

export type ParseResult = {
  todos: TodoDraft[];
  source: "llm" | "heuristic" | "offline";
};

/**
 * Asks the server to turn a transcript into drafts, falling back to on-device
 * parsing if the route (or the model behind it) is unreachable.
 */
export async function parseTodosFromTranscript(transcript: string): Promise<ParseResult> {
  try {
    const response = await fetch("/api/parse-todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!response.ok) throw new Error(`Parse request failed with ${response.status}`);
    const payload: unknown = await response.json();
    const todos = coerceDrafts(payload);
    const source = (payload as { source?: unknown }).source;
    return { todos, source: source === "llm" ? "llm" : "heuristic" };
  } catch {
    return { todos: parseTranscript(transcript), source: "offline" };
  }
}
