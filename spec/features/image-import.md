# Image import

Fixtures: [`../fixtures/image-import.json`](../fixtures/image-import.json). Scenario: [`../scenarios/core/import-image.json`](../scenarios/core/import-image.json).

Paste or pick an image (a screenshot of another todo app, a photo of a handwritten list, a single sticky note) and the app turns it into one or more todos. An AI model decides how many tasks the image holds. The todos are added right away, like voice capture, with an Undo.

## Flow

- **Web**: Cmd/Ctrl+V with an image on the clipboard anywhere on the Today tab (also inside text fields; pasting text still pastes text), or the image button next to the mic, which opens a file picker (`image/*`).
- **iOS**: the image button opens a menu with **Paste image** (system `PasteButton`, so no paste prompt) and **Choose photo** (`PhotosPicker`).
- **Android**: the image button opens a menu with **Paste image** (an image `content://` URI on the clipboard) and **Choose photo** (system photo picker, `PickVisualMedia`).
- The client scales the image so its longer edge is at most `maxDimension` pixels, re-encodes it as JPEG at `jpegQuality`, and checks it with `checkImageUpload` before sending.
- While the request runs, the status reads "Reading image…" and the image button is disabled. On success the todos are prepended (one `prepend`, so one Undo removes them all) and the status reads "Added N todos" with Undo. No todos → "No tasks found in that image." Errors show the `image.error.<code>` message; nothing is added.
- Read-only lists (realtime.md#connection-status) disable the button and ignore pastes.

## Server: `POST /api/image-todos`

Hosted by the web app (Vercel). Native apps call it at their configured API base URL (`API_BASE_URL`, default `https://todo-tracker-puce.vercel.app`). No sign-in is required, like `/api/parse-todos`.

- Request JSON: `{ image: <base64, no data: prefix>, mimeType, today: "YYYY-MM-DD" }`. `today` is the device's local date, so dates shown without a year ("Nov 3") resolve against it.
- The route rejects bad JSON or a missing image with `400 {error: "invalid"}` and runs `checkImageUpload` on the decoded bytes (`415 unsupported`, `413 tooLarge`, `400 invalid`).
- It calls Gemini (`GEMINI_API_KEY`, server-side only; model `GEMINI_MODEL`, default `gemini-3.5-flash-lite`) with a JSON response schema `{todos: [{title, notes?, priority?, dueDate?}]}` and returns `200 {todos}` after `coerceImageDrafts`.
- Prompt rules: one todo per distinct open task; skip done items (checked, struck through, greyed out); merge text that wraps over lines; keep the image's wording; ignore UI chrome (headers, counts, buttons, menus, the status bar); `dueDate` only when a date is shown for that task; `priority` only when the image marks one; a short description under a task becomes `notes`. A photo of one thing to do (a bill, a flyer) becomes one todo describing the action.
- Failures: no key → `503 unavailable`; Gemini 429 → `429 busy`; any other model or parse failure → `502 failed`.

## Rules

- `IMAGE_IMPORT` constants (`imageImportConstants`): accepted types `image/heic`, `image/heif`, `image/jpeg`, `image/png`, `image/webp`; `maxBytes` 3,000,000 decoded bytes (base64 adds a third, staying under Vercel's 4.5 MB body limit); `maxDimension` 2048; `jpegQuality` 0.85; `maxTodos` 50.
- `checkImageUpload(mimeType, bytes)`: a type outside the list (case-insensitive) → `unsupported`, checked first; then `bytes <= 0` → `invalid`; then `bytes > maxBytes` → `tooLarge`; else `ok`.
- `imageImportErrorFor(status, body)`: a known `body.error` code (`busy`, `failed`, `invalid`, `offline`, `tooLarge`, `unavailable`, `unsupported`) wins; otherwise 400 → `invalid`, 413 → `tooLarge`, 415 → `unsupported`, 429 → `busy`, 503 → `unavailable`, anything else → `failed`. A network error is `offline` on the client.
- `coerceImageDrafts(value)` validates model output (`{todos: [...]}` or a bare array; strings count as titles):
  - Title: whitespace runs collapse to one space and the result is trimmed; then one leading list marker followed by whitespace is removed (`-`, `*`, `•`, `◦`, `▪`, `·`, `[ ]`, `[]`, `☐`, or 1–3 digits plus `.` or `)`), and it is collapsed and trimmed again. Unlike voice, filler words and punctuation are kept. It must be a valid title (1–200 characters).
  - Duplicates: a title equal to an earlier one, ignoring case, is dropped.
  - `notes` is trimmed; blank notes and notes equal to the title (ignoring case) are dropped.
  - `priority` must be exactly `low|medium|high`; `dueDate` must be a real calendar date `YYYY-MM-DD` (leap years included); anything else is dropped.
  - At most `maxTodos` drafts are returned, in order.
