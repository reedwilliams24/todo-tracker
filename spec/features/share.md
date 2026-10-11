# Share / quick-add

Fixtures: [`../fixtures/share.json`](../fixtures/share.json).

Text shared into the app from somewhere else becomes new todos. Each platform has its own entry point; all of them run the shared text through `draftsFromSharedText` and add the result with `addTodos` (prepended, no undo entry, like any other add).

| Platform | Entry points |
| --- | --- |
| Web | `/?add=<text>` (repeatable), plus `text` / `title` for Web Share Target-style URLs. The params are removed from the URL after the todos are added, so a reload doesn't add them again. |
| Android | The system share sheet (`ACTION_SEND`, `text/plain`: `EXTRA_SUBJECT` then `EXTRA_TEXT`) and the deep link `todotracker://add?add=<text>`. |
| iOS | The URL scheme `todotracker://add?add=<text>` (usable from Shortcuts, which can appear in the share sheet). A Share Extension is a follow-up. |

Shared text is only applied once the stored list has loaded, so de-duplication sees existing todos.

## Rules

- **`draftsFromSharedText(texts, existing)`** returns one `{ title }` draft per line of every text, in order:
  - Lines split on `\n` or `\r\n`.
  - Runs of whitespace (JavaScript `\s`) collapse to one space; the result is trimmed.
  - Lines that are not valid titles (`isValidTitle`: blank, or more than 200 characters) are skipped.
  - **De-duplicated** case-insensitively against each other and against the trimmed titles of `existing`. The first occurrence wins and keeps its casing.
  - At most **50** drafts per share; the rest are dropped.
- **`sharedTextFromQuery(search)`** reads a URL query string (with or without the leading `?`) using `application/x-www-form-urlencoded` rules (like `URLSearchParams`: `+` is a space, `%XX` is percent-decoded, a malformed escape is kept as-is). It returns every `add` value, then every `text` value, then every `title` value, each in the order they appear. Empty values are kept (they are dropped later by `draftsFromSharedText`).
- `stripShareParams(search)` (web only, not a fixture) removes `add`, `text` and `title` and keeps every other param.
