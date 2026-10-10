# Voice capture fallback parser

Fixtures: [`../fixtures/voice.json`](../fixtures/voice.json).

The web app turns a spoken transcript into todo drafts with an LLM and uses this regex parser as the fallback and as a cross-check. Native apps that add voice capture must match these cases.

## Rules

- `parseTranscript` splits on `and then`, `after that`, `also`, `and also`, `;`, newlines, a comma followed by `and`, and sentence ends (`. `). Each segment goes through `extractPriority`, then `extractDueDate`, then `cleanTitle`; segments with an invalid title are dropped. Plain `and` and commas do **not** split (see the first `parseTranscript` case).
- `extractPriority`: first match wins, checked in this order: `urgent(ly)`, `asap`, `critical`, `high priority`, `important` → `high`; `low priority`, `whenever`, `no rush`, `someday`, `eventually` → `low`; `medium priority`, `normal priority` → `medium`. The phrase is removed and the surrounding whitespace is left for `cleanTitle`.
- `extractDueDate` (first match wins): `today`, `tonight` → today; `tomorrow` → +1 day; `next week` → +7 days; a weekday, optionally preceded by `on`, `by` or `next` → the next such day, never today (Monday + `monday` = +7). Dates use the device's **local** time zone; fixture `now` values have no `Z` for this reason.
- `cleanTitle` strips leading filler (`um`, `uh`, `ok`, `so`, `hey`, `please`, `remind me to`, `I need/have/want to`, `remember to`, `add a todo/task/item to`, `create a todo to`, `make a note to`, `let's`), leading and trailing punctuation, and collapses whitespace.
- `coerceDrafts` validates model output (`{todos: [...]}` or a bare array; strings count as titles). Titles are cleaned and must be valid; priorities other than exact `low|medium|high` and dates that are not `YYYY-MM-DD` are dropped.
- `reconcileDrafts`: with no model drafts, returns the heuristic drafts. Otherwise, each heuristic draft is replaced by the first model draft describing the same task, and model drafts that matched nothing are appended.
