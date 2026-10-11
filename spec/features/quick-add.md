# Quick add shorthand

Fixtures: [`../fixtures/quick-add.json`](../fixtures/quick-add.json). Scenario: `quick-add-shorthand` in [`../scenarios/core.json`](../scenarios/core.json).

The add form's title field accepts shorthand such as `call mom tomorrow 5pm #family !p1`. While typing, the form shows a live preview (`quickAddPreview`, with the parsed title in `quickAddPreviewTitle`) whenever the input has a priority, due date or tag. Submitting adds the parsed draft.

## Rules

`parseQuickAdd(input, now)` returns `{title, priority?, dueDate?, tags}`, applying these steps in order to the remaining text:

1. **Tags**: every `#tag` at the start of the input or after whitespace, where the tag is one or more Unicode letters, digits, `_` or `-`. Tags are lowercased and de-duplicated in order of first appearance, and removed from the text (the leading whitespace stays). `#` inside a word (`issue#31`) is not a tag. Todos don't store tags yet; they only show in the preview.
2. **Priority**: the first `!p1`/`!high` → `high`, `!p2`/`!med`/`!medium` → `medium`, `!p3`/`!low` → `low` (case-insensitive, at the start or after whitespace, ending at a word boundary). The token and its leading whitespace are replaced with a space. Without a bang token, the spoken-priority rules of `extractPriority` ([voice](voice.md)) apply (`asap`, `urgent`, `low priority`, …).
3. **Due date**, first match wins:
   - the first `YYYY-MM-DD` at the start or after whitespace, optionally preceded by `on `, `by ` or `due `, **if it is a real date** (`isValidDueDate`). An invalid date stays in the title and the remaining rules still apply.
   - `in N day(s)` (N = 1–3 digits) → today + N.
   - otherwise `extractDueDate` ([voice](voice.md)): today, tonight, tomorrow, next week, weekdays.
   Dates use the device's **local** calendar; fixture `now` values have no `Z`.
4. **Title**: `cleanTitle` ([voice](voice.md)) on what's left. Times such as `5pm` stay in the title because todos carry a date only.

`hasQuickAddMeta(parse)` is true when the parse has a priority, a due date or at least one tag; the preview is shown only then.

`quickAddToDraft(parse, fallbackPriority, fallbackDueDate)` builds the draft: parsed values win, and the form's priority and due-date controls are the fallback. An empty fallback due date means no due date. The add button is enabled when the **parsed** title is valid.
