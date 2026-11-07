import { NextResponse } from "next/server";
import { checkImageUpload, coerceImageDrafts, type ImageImportError } from "@/domain";

/** Image → todos via Gemini (spec/features/image-import.md). */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 30000);

export const maxDuration = 60;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    todos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          notes: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          dueDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["title"],
      },
    },
  },
  required: ["todos"],
} as const;

function buildPrompt(today: string): string {
  return [
    "Turn this image into todo items for a todo app.",
    `Today is ${today}; resolve dates shown without a year against it.`,
    "Rules:",
    "- Decide whether the image holds one task or many, and return one todo per distinct open task.",
    "- Skip tasks that are already done (checked, struck through or greyed out).",
    "- Merge text that wraps over several lines into one title. Keep the image's wording.",
    "- Ignore UI chrome: column and section headers, counts, buttons such as 'Add task', menus, the status bar.",
    "- A photo of one thing to deal with (a bill, a flyer, a broken item) becomes one todo describing the action.",
    "- dueDate (YYYY-MM-DD) only when a date is shown for that task.",
    "- priority only when the image marks one (a flag, P1, 'urgent').",
    "- A short description shown under a task goes in notes.",
    "- Return an empty list if the image holds no tasks.",
  ].join("\n");
}

function fail(error: ImageImportError, status: number) {
  return NextResponse.json({ error }, { status });
}

function isoToday(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  let body: { image?: unknown; mimeType?: unknown; today?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("invalid", 400);
  }
  if (typeof body.image !== "string" || typeof body.mimeType !== "string") return fail("invalid", 400);

  const image = body.image.replace(/^data:[^,]*,/, "");
  const check = checkImageUpload(body.mimeType, Buffer.byteLength(image, "base64"));
  if (check === "unsupported") return fail("unsupported", 415);
  if (check === "tooLarge") return fail("tooLarge", 413);
  if (check === "invalid") return fail("invalid", 400);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail("unavailable", 503);

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: body.mimeType.toLowerCase(), data: image } },
              { text: buildPrompt(isoToday(body.today)) },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return fail("failed", 502);
  }
  if (response.status === 429) return fail("busy", 429);
  if (!response.ok) return fail("failed", 502);

  try {
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    return NextResponse.json({ todos: coerceImageDrafts(JSON.parse(text)) });
  } catch {
    return fail("failed", 502);
  }
}
