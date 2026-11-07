import { checkImageUpload, coerceImageDrafts, IMAGE_IMPORT, imageImportErrorFor } from "web/domain";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "image-import",
  spec: "features/image-import.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "imageImportConstants", given: {} },
    ...[
      ["jpeg", "image/jpeg", 120_000],
      ["png", "image/png", 2_500_000],
      ["upper-case type", "IMAGE/PNG", 10],
      ["exactly the limit", "image/webp", 3_000_000],
      ["one byte over", "image/jpeg", 3_000_001],
      ["empty", "image/heic", 0],
      ["gif", "image/gif", 100],
      ["pdf", "application/pdf", 100],
      ["unsupported and too large", "image/tiff", 9_000_000],
    ].map(([label, mimeType, bytes]) => ({
      name: `checkImageUpload ${label}`,
      op: "checkImageUpload",
      given: { mimeType, bytes },
    })),
    ...(
      [
        ["error code wins", 500, { error: "busy" }],
        ["unknown code falls back to status", 429, { error: "slow down" }],
        ["400", 400, null],
        ["413", 413, "Request Entity Too Large"],
        ["415", 415, {}],
        ["429", 429, null],
        ["503", 503, null],
        ["500", 500, null],
        ["502 with code", 502, { error: "failed" }],
      ] as const
    ).map(([label, status, body]) => ({
      name: `imageImportErrorFor ${label}`,
      op: "imageImportErrorFor",
      given: { status, body },
    })),
    {
      name: "coerceImageDrafts keeps wording and drops junk",
      op: "coerceImageDrafts",
      given: {
        value: {
          todos: [
            { title: "  Put in repair request for\n bedroom light and blinds ", priority: "medium" },
            { title: "Expense chatgpt?", priority: "HIGH" },
            { title: "Clear work inbox", dueDate: "2026-11-03", priority: "high" },
            { title: "Wipe everything down", notes: "  Dust and wipe " },
            { title: "Pay rent", dueDate: "2026-02-30" },
            { title: "Renew passport", dueDate: "Nov 3" },
            { title: "Call mom", notes: "call mom" },
            { title: "   " },
            { priority: "low" },
            42,
          ],
        },
      },
    },
    {
      name: "coerceImageDrafts strips list bullets",
      op: "coerceImageDrafts",
      given: {
        value: [
          "- Buy milk",
          "• Call the bank",
          "[ ] File taxes",
          "☐ Water plants",
          "3. Book flights",
          "2) Pack",
          "-not a bullet",
          "2026 budget review",
        ],
      },
    },
    {
      name: "coerceImageDrafts drops case-insensitive duplicates, keeping the first",
      op: "coerceImageDrafts",
      given: { value: { todos: [{ title: "Get mail" }, { title: "get  MAIL", priority: "high" }, "- Get mail"] } },
    },
    {
      name: "coerceImageDrafts accepts leap days only in leap years",
      op: "coerceImageDrafts",
      given: {
        value: [
          { title: "a", dueDate: "2028-02-29" },
          { title: "b", dueDate: "2027-02-29" },
          { title: "c", dueDate: "2100-02-29" },
          { title: "d", dueDate: "2000-02-29" },
          { title: "e", dueDate: "2026-13-01" },
          { title: "f", dueDate: "2026-04-31" },
          { title: "g", dueDate: "2026-04-00" },
        ],
      },
    },
    {
      name: "coerceImageDrafts caps the count",
      op: "coerceImageDrafts",
      given: { value: Array.from({ length: 55 }, (_, index) => `Task ${index + 1}`) },
    },
    {
      name: "coerceImageDrafts drops titles over 200 characters",
      op: "coerceImageDrafts",
      given: { value: ["x".repeat(201), "y".repeat(200)] },
    },
    { name: "coerceImageDrafts rejects non-objects", op: "coerceImageDrafts", given: { value: "buy milk" } },
    { name: "coerceImageDrafts handles no todos", op: "coerceImageDrafts", given: { value: { todos: [] } } },
  ],
};

export const ops: Ops = {
  checkImageUpload: (g) => checkImageUpload(g.mimeType, g.bytes),
  coerceImageDrafts: (g) => coerceImageDrafts(g.value),
  imageImportConstants: () => IMAGE_IMPORT,
  imageImportErrorFor: (g) => imageImportErrorFor(g.status, g.body),
};
