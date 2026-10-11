# Tags

Fixtures: [`../fixtures/tags.json`](../fixtures/tags.json). Shape: `tags` in [`../schema/todo.schema.json`](../schema/todo.schema.json).

## Rules

- **Field**: a todo has an optional `tags: string[]`. An empty list is never stored; the field is omitted instead.
- **Parsing** (`parseTags`): the add form takes comma-separated text. Split on `,`, trim each piece, strip one leading `#`, trim again, lowercase. Drop empty pieces and duplicates (the first occurrence keeps its position). `"Work, #urgent, work"` → `["work", "urgent"]`.
- **Create**: `createTodo` runs the draft's tags through the same normalization (joined with `,`), so tags from any source end up normalized.
- **Edits**: toggle, rename, undo and storage keep tags unchanged.
- **All tags** (`allTags`): every distinct tag across the list, sorted by UTF-16 code units (JS `Array.prototype.sort`).
- **Filter by tag** (`filterByTag`): todos whose tags contain the tag exactly, in list order. A null or empty tag returns every todo.
- **UI**:
  - The add form has a tags field (`formTags`) that suggests existing tags.
  - Each item shows its tags as `#tag` chips in a group (`itemTags`) whose accessible label is the chips joined by spaces, e.g. `#work #urgent`.
  - When any todo has tags, a row of chips (`tagFilter`, one per `allTags` entry) sits above the list. Tapping a chip selects it; tapping the selected chip clears it. One tag at a time.
  - The tag filter applies together with the status filter (and search on web). If the selected tag no longer exists, the filter clears.
  - Empty state with a tag selected: `No todos tagged #work.` / `No completed todos tagged #work.`
