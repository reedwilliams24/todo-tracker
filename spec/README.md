# Conformance spec

Language-neutral definition of how Todo Tracker behaves. Web (TypeScript), iOS (Swift) and Android (Kotlin) each implement the domain logic natively and must all pass the same fixtures and UI scenarios. When the platforms disagree, this directory decides.

```
spec/
  features/*.md        human-readable rules, one file per feature
  schema/*.schema.json JSON Schemas: todo, stored list, fixture file
  fixtures/*.json      golden cases: { name, op, given, then }
  test-ids.json        shared UI selector registry
  scenarios/core.json  platform-neutral UI scenarios
  scenarios/maestro/   Maestro flows generated from core.json (mobile)
  platforms.json       which platform passes which feature (CI parity matrix)
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @todo/spec test` | TypeScript fixture runner + schema validation |
| `pnpm spec:record` | Re-records `fixtures/*.json` from `packages/spec/src/cases.ts` and the current TS implementation |
| `pnpm spec:generate` | Regenerates `packages/shared/src/test-ids.ts` and `scenarios/maestro/*.yaml` |
| `pnpm spec:check` | Fails if fixtures or generated files are stale |
| `pnpm spec:parity` | Prints the parity matrix from `platforms.json` |
| `pnpm --filter web e2e` | Runs `scenarios/core.json` (and the older web-only specs) with Playwright |
| `maestro test --include-tags spec -e APP_ID=… spec/scenarios/maestro` | Runs the scenarios on a device or emulator (see below) |

## Fixtures

Each file in `fixtures/` covers one feature:

```json
{ "feature": "todo", "spec": "features/todo.md", "cases": [
  { "name": "toggleTodo completes", "op": "toggleTodo",
    "given": { "todo": { … }, "now": "2026-01-05T10:00:00.000Z" },
    "then": { … } } ] }
```

A runner calls the platform's implementation of `op` with `given` and asserts that the normalized result deep-equals `then`. The ops and their arguments are listed in `packages/spec/src/ops.ts`, which is the reference adapter.

Cases are written in `packages/spec/src/cases.ts` and `then` is recorded from the TypeScript implementation. To change behavior: update the spec markdown, change the code, run `pnpm spec:record`, and review the fixture diff in the PR. The fixture diff is the behavior change.

### Normalization

Runners must apply the same normalization before comparing:

- **Absent vs null**: optional fields that are absent, `null` or `undefined` are omitted from objects. `then` never contains `null` object values (top-level `null` results are allowed, e.g. `undoLabel`).
- **New ids**: any `id` in the result that does not appear in `given` is renamed `new-1`, `new-2`, … in order of first appearance in the serialized result.
- **Time**: every op that reads the clock takes `now` from `given`. UTC timestamps end in `Z`; voice ops use local time without `Z`, so runners must parse them as local.
- **Comparison**: JSON deep equality. Array order matters.

### Native runners (REED-27)

Swift and Kotlin load the same files; nothing is copied or regenerated per platform.

- **iOS (XCTest)**: add `../../spec/fixtures` to the test target as a folder reference. A `FixtureTests` case decodes each file, switches on `op`, calls the Swift implementation, encodes the result with `JSONEncoder` (`.sortedKeys`), applies normalization, and compares with `then` decoded as `JSONValue`. One `XCTContext.runActivity` per case gives per-case reporting.
- **Android (JUnit 5)**: point `sourceSets.test.resources.srcDir("../../spec/fixtures")` at the folder. A `@TestFactory` returns one `DynamicTest` per case, dispatches on `op` to the Kotlin implementation, serializes with kotlinx.serialization (`explicitNulls = false`), normalizes, and asserts JSON equality.
- An unknown `op` must **fail**, not skip, so a new fixture can't silently pass on a platform that doesn't implement it. Update `platforms.json` when a platform starts passing a feature.

## UI scenarios

`scenarios/core.json` lists user flows as steps. Every platform drives its UI through the IDs in `test-ids.json` (`data-testid` on web, `testID` in React Native, `accessibilityIdentifier` in SwiftUI, `Modifier.testTag` with `testTagsAsResourceId` in Compose). `{title}` placeholders take the todo's title.

Actions (`do`): `add {title, priority?, dueDate?}`, `toggle {title}`, `delete {title}`, `rename {from, to}`, `filter {filter}`, `search {query}`, `clearCompleted`, `undo`, `relaunch`.

Assertions (`expect`): `empty`, `titles {titles}` (web checks exact order; Maestro checks each is visible), `remaining {text}`, `completed {title, value}`, `undo {label | null}`.

A scenario may set `platforms` (`web`, `mobile`) when a feature isn't on every platform yet, e.g. mobile has no search today.

Running on Android with the current Expo app:

```bash
cd apps/mobile && npx expo start            # Metro on :8081, open in Expo Go on the emulator once
maestro test --include-tags spec -e APP_ID=host.exp.exponent -e EXPO_URL=exp://10.0.2.2:8081 spec/scenarios/maestro
```

For the native apps, pass `-e APP_ID=com.reedwilliams24.todotracker` and no `EXPO_URL`.
