import type { Todo, TodoDraft } from "@todo/shared";
import { coerceDrafts, parseTranscript } from "@todo/shared";

export type ParseResult = {
  todos: TodoDraft[];
  source: "llm" | "heuristic" | "offline";
};

/**
 * Asks the server to turn a transcript into drafts, falling back to on-device
 * parsing if the route (or the model behind it) is unreachable. Open todos are
 * sent along so the model can rate a new todo's priority against them.
 */
export async function parseTodosFromTranscript(
  transcript: string,
  existingTodos: readonly Todo[] = [],
): Promise<ParseResult> {
  try {
    const response = await fetch("/api/parse-todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript,
        existingTodos: existingTodos
          .filter((todo) => !todo.completed)
          .map(({ title, priority, dueDate }) => ({ title, priority, dueDate })),
      }),
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
