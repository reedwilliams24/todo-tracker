import { NextResponse } from "next/server";
import { coerceDrafts, parseTranscript, type TodoDraft } from "@todo/shared";

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

function buildPrompt(transcript: string, today: string): string {
  return [
    "Extract the actionable todo items from this dictated text.",
    "Rules:",
    "- One object per task; `title` is a short imperative phrase with filler words removed.",
    '- Include `priority` ONLY when urgency is stated: "asap"/"urgent"/"important" -> high, "whenever"/"no rush" -> low. Otherwise omit it.',
    `- Include \`dueDate\` (YYYY-MM-DD, today is ${today}) ONLY when the speaker states a time. Otherwise omit it.`,
    "- Never invent tasks, dates, or priorities.",
    "- Return every task mentioned, in the order spoken, even if the sentence is run-on.",
    "",
    'Example input: "grab coffee and then submit the report today, it is urgent"',
    `Example output: {"todos":[{"title":"Grab coffee"},{"title":"Submit the report","priority":"high","dueDate":"${today}"}]}`,
    "",
    `Dictated text: """${transcript}"""`,
  ].join("\n");
}

async function parseWithOllama(transcript: string, today: string): Promise<TodoDraft[]> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(transcript, today),
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
  try {
    ({ transcript } = (await request.json()) as { transcript?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const todos = await parseWithOllama(transcript, today);
    if (todos.length > 0) {
      return NextResponse.json({ todos, source: "llm" });
    }
  } catch (error) {
    console.warn("Falling back to heuristic transcript parsing:", error);
  }

  return NextResponse.json({ todos: parseTranscript(transcript), source: "heuristic" });
}
