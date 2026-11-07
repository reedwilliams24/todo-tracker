import {
  checkImageUpload,
  coerceImageDrafts,
  IMAGE_IMPORT,
  imageImportErrorFor,
  localDateKey,
  type ImageImportError,
  type TodoDraft,
} from "@/domain";

export type ImageImportResult = { todos: TodoDraft[] } | { error: ImageImportError };

/** Scales the longer edge to IMAGE_IMPORT.maxDimension and re-encodes as JPEG. */
async function downscale(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_IMPORT.maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/jpeg",
      IMAGE_IMPORT.jpegQuality,
    ),
  );
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Sends an image to `/api/image-todos` (spec/features/image-import.md) and validates the drafts it returns. */
export async function importTodosFromImage(file: Blob, now: Date = new Date()): Promise<ImageImportResult> {
  let jpeg: Blob;
  try {
    jpeg = await downscale(file);
  } catch {
    return { error: file.type.startsWith("image/") ? "invalid" : "unsupported" };
  }
  const check = checkImageUpload(jpeg.type, jpeg.size);
  if (check !== "ok") return { error: check };

  let response: Response;
  try {
    response = await fetch("/api/image-todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: await toBase64(jpeg), mimeType: jpeg.type, today: localDateKey(now) }),
    });
  } catch {
    return { error: "offline" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { error: imageImportErrorFor(response.status, body) };
  return { todos: coerceImageDrafts(body) };
}
