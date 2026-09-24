import { NextResponse } from "next/server";
import { coerceDrafts, parseTranscript, reconcileDrafts, type TodoDraft } from "@todo/shared";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 20000);

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    todos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          dueDate: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["todos"],
} as const;

function describeExisting(existing: ExistingTodo[]): string {
  if (existing.length === 0) return "The list is currently empty.";
  return existing
    .slice(0, 20)
    .map((todo) => `- ${todo.title} (${todo.priority}${todo.dueDate ? `, due ${todo.dueDate}` : ""})`)
    .join("\n");
}

function buildPrompt(transcript: string, today: string, existing: ExistingTodo[]): string {
  return [
    "Extract the actionable todo items from this dictated text.",
    "Rules:",
    "- One object per task; `title` is a short imperative phrase with filler words removed.",
    '- Always set `priority`. Use what the speaker says when they say it ("asap"/"urgent" -> high, "whenever"/"no rush" -> low); otherwise judge it yourself from how consequential and time-sensitive the task is, staying consistent with how the existing todos below are rated.',
    `- Set \`dueDate\` (YYYY-MM-DD, today is ${today}) ONLY when the speaker states a time. Never guess a date.`,
    "- Never invent tasks, and only attach a stated priority or date to the task it was spoken about.",
    "- Return every task mentioned, in the order spoken, even if the sentence is run-on.",
    "",
    "Existing todos, for calibrating priority:",
    describeExisting(existing),
    "",
    'Example input: "grab coffee and then submit the tax return today, it is urgent"',
    `Example output: {"todos":[{"title":"Grab coffee","priority":"low"},{"title":"Submit the tax return","priority":"high","dueDate":"${today}"}]}`,
    "",
    `Dictated text: """${transcript}"""`,
  ].join("\n");
}

type ExistingTodo = { title: string; priority: string; dueDate?: string };

function coerceExisting(value: unknown): ExistingTodo[] {
  if (!Array.isArray(value)) return [];
  const todos: ExistingTodo[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const { title, priority, dueDate } = item as Record<string, unknown>;
    if (typeof title !== "string") continue;
    todos.push({
      title: title.slice(0, 200),
      priority: typeof priority === "string" ? priority : "medium",
      dueDate: typeof dueDate === "string" ? dueDate : undefined,
    });
  }
  return todos;
}

async function parseWithOllama(
  transcript: string,
  today: string,
  existing: ExistingTodo[],
): Promise<TodoDraft[]> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(transcript, today, existing),
      format: RESPONSE_SCHEMA,
      stream: false,
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Ollama responded with ${response.status}`);
  }

  const payload: unknown = await response.json();
  const text = (payload as { response?: unknown }).response;
  if (typeof text !== "string") {
    throw new Error("Ollama response missing generated text");
  }

  return coerceDrafts(JSON.parse(text));
}

export async function POST(request: Request) {
  let transcript: unknown;
  let existingTodos: unknown;
  try {
    ({ transcript, existingTodos } = (await request.json()) as {
      transcript?: unknown;
      existingTodos?: unknown;
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const heuristic = parseTranscript(transcript);

  try {
    const todos = await parseWithOllama(transcript, today, coerceExisting(existingTodos));
    if (todos.length > 0) {
      return NextResponse.json({ todos: reconcileDrafts(heuristic, todos), source: "llm" });
    }
  } catch (error) {
    console.warn("Falling back to heuristic transcript parsing:", error);
  }

  return NextResponse.json({ todos: heuristic, source: "heuristic" });
}
