# Conformance spec

Language-neutral definition of how Todo Tracker behaves. Web (TypeScript), iOS (Swift) and Android (Kotlin) each implement the domain logic natively and must all pass the same fixtures and UI scenarios. When the platforms disagree, this directory decides.

```
spec/
  features/*.md        human-readable rules, one file per feature
  schema/*.schema.json JSON Schemas: todo, stored list, fixture file
  fixtures/*.json      golden cases: { name, op, given, then }
  test-ids.json        shared UI selector registry
  scenarios/core/     platform-neutral UI scenarios, one file per scenario
  scenarios/maestro/   Maestro flows generated from core/ (mobile)
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @todo/spec test` | TypeScript fixture runner + schema validation |
| `pnpm spec:record` | Re-records `fixtures/*.json` from `packages/spec/src/features/*.ts` and the current TS implementation |
| `pnpm spec:generate` | Regenerates `apps/web/src/domain/test-ids.ts` and `scenarios/maestro/*.yaml` |
| `pnpm spec:check` | Fails if fixtures or generated files are stale |
| `pnpm spec:parity` | Prints the parity matrix from each fixture's and scenario's `status` |
| `pnpm --filter web e2e` | Runs `scenarios/core/*.json` (and the older web-only specs) with Playwright |
| `maestro test --include-tags spec -e APP_ID=… spec/scenarios/maestro` | Runs the scenarios on a device or emulator (see below) |

## Fixtures

Each file in `fixtures/` covers one feature:

```json
{ "feature": "todo", "spec": "features/todo.md", "cases": [
  { "name": "toggleTodo completes", "op": "toggleTodo",
    "given": { "todo": { … }, "now": "2026-01-05T10:00:00.000Z" },
    "then": { … } } ] }
```

A runner calls the platform's implementation of `op` with `given` and asserts that the normalized result deep-equals `then`. Each feature's ops and their arguments are in `packages/spec/src/features/<feature>.ts`, which is the reference adapter.

Cases are written in `packages/spec/src/features/<feature>.ts` (with the feature's `status` per platform) and `then` is recorded from the TypeScript implementation. To change behavior: update the spec markdown, change the code, run `pnpm spec:record`, and review the fixture diff in the PR. The fixture diff is the behavior change.

### Normalization

Runners must apply the same normalization before comparing:

- **Absent vs null**: optional fields that are absent, `null` or `undefined` are omitted from objects. `then` never contains `null` object values (top-level `null` results are allowed, e.g. `undoLabel`).
- **New ids**: any `id` in the result that does not appear in `given` is renamed `new-1`, `new-2`, … in order of first appearance in the serialized result.
- **Time**: every op that reads the clock takes `now` from `given`. UTC timestamps end in `Z`; voice ops use local time without `Z`, so runners must parse them as local.
- **Comparison**: JSON deep equality. Array order matters.

### Native runners (REED-27)

Swift and Kotlin load the same files; nothing is copied or regenerated per platform.

- **iOS (XCTest)**: `apps/ios/TodoCore` is a Swift package whose `FixtureTests` resolve `spec/fixtures` from `#filePath`. Each test decodes each file, switches on `op`, calls the Swift implementation, encodes the result with `JSONEncoder` (`.sortedKeys`), applies normalization, and compares with `then` decoded as `JSONValue`. One `XCTContext.runActivity` per case gives per-case reporting.
- **Android (JUnit 5)**: point `sourceSets.test.resources.srcDir("../../spec/fixtures")` at the folder. A `@TestFactory` returns one `DynamicTest` per case, dispatches on `op` to the Kotlin implementation, serializes with kotlinx.serialization (`explicitNulls = false`), normalizes, and asserts JSON equality.
- An unknown `op` must **fail**, not skip, so a new fixture can't silently pass on a platform that doesn't implement it. Update the feature's `status` when a platform starts passing it.

## UI scenarios

Each file in `scenarios/core/` is one user flow: `{ name, status, steps }`, where `name` matches the file name and `status` says which platforms pass it (`n/a` skips that platform). Every platform drives its UI through the IDs in `test-ids.json` (`data-testid` on web, `accessibilityIdentifier` in SwiftUI, `Modifier.testTag` with `testTagsAsResourceId` in Compose). `{title}` placeholders take the todo's title.

New feature scenarios add a file in `scenarios/core/`, and each step kind below is one line, in alphabetical order, so parallel PRs don't conflict.

Actions (`do`):

- `add {title, priority?, dueDate?, recurrence?}`
- `bulkDelete {confirm}` (tap Delete, then Delete or Cancel in the confirmation)
- `bulkToggle`
- `clearCompleted`
- `delete {title}`
- `filter {filter}`
- `openStats`
- `relaunch`
- `rename {from, to}`
- `search {query}`
- `select {title}`
- `selectAll`
- `selectMode` (tap Select/Done)
- `sort {sort}`
- `submit`
- `theme {theme}`
- `toggle {title}`
- `type {text}` (fills the add form's title without submitting)
- `undo`

Assertions (`expect`):

- `clearCompleted {text}`
- `completed {title, value}`
- `dueDate {title, dueDate}` and `recurrence {title, text}` (some todo with that title shows that value)
- `empty`
- `overdue {title, value}`
- `priority {title, priority}` (case-insensitive)
- `quickAddPreview {title | null}` (`null`: preview hidden)
- `remaining {text}`
- `selected {text}`
- `stats {total, current, longest}` (the Stats panel's texts)
- `theme {theme}` (that theme option is selected; web also checks the `dark` class on `<html>` for `light`/`dark`)
- `titles {titles}` (web checks exact order; Maestro checks each is visible)
- `undo {label | null}`

Running on the Android emulator or iOS Simulator, with the native app installed:

```bash
maestro test --include-tags spec -e APP_ID=com.reedwilliams24.todotracker spec/scenarios/maestro
```
