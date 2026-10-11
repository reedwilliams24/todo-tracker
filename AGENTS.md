# AGENTS.md

Guide for humans and AI agents working in this repo.

## Architecture

- `apps/web`: Next.js 15 web client. `src/domain` holds its TypeScript domain logic (todos, list ops, undo reducer `store.ts`, storage format, voice parser) and the generated `TEST_IDS`. It is also the reference implementation the fixtures are recorded from (`packages/spec` imports it as `web/domain`).
- `packages/spec`: conformance tooling. It holds the fixture cases, the TS runner, code generation, and the parity matrix.
- `apps/android`: native Android app (Kotlin/Compose, Room). `:core` is the pure Kotlin domain port plus the JUnit fixture runner. `:app` is the UI. See [`apps/android/README.md`](apps/android/README.md).
- `apps/ios`: native iOS app (Swift/SwiftUI, SwiftData). `TodoCore` is the Swift domain port plus the XCTest fixture runner. See [`apps/ios/README.md`](apps/ios/README.md).
- `spec/`: the language-neutral contract every platform must satisfy. Start with [`spec/README.md`](spec/README.md).

Every product change applies to web, iOS and Android unless the ticket says otherwise. Native apps reimplement the logic in Swift and Kotlin. They don't share code; they share `spec/`.

## Verify

```bash
pnpm install
pnpm lint
pnpm lint:ios             # SwiftLint (apps/ios/.swiftlint.yml)
pnpm format:check        # Prettier + ktfmt + swift-format; fix with `pnpm format`
pnpm typecheck
pnpm test                 # web domain unit tests + the TS fixture runner (packages/spec)
pnpm spec:check           # fixtures and generated files are up to date
pnpm spec:parity          # web/iOS/Android parity matrix
pnpm build
pnpm --filter web e2e     # Playwright, incl. spec/scenarios/core/*.json
(cd apps/android && ./gradlew :core:test :app:assembleDebug)  # Kotlin fixtures + APK
```

iOS (macOS + Xcode): `swift test` in `apps/ios/TodoCore` runs the fixtures; see [`apps/ios/README.md`](apps/ios/README.md) for the app.

Mobile scenarios: `maestro test --include-tags spec -e APP_ID=… spec/scenarios/maestro` (see `spec/README.md`).

## Definition of done for a behavior change

1. Update the rule in `spec/features/<feature>.md`.
2. Add or change cases in `packages/spec/src/features/<feature>.ts` (a new feature gets a new file there, with its own ops and `status`), change the code, and run `pnpm spec:record`. The diff in `spec/fixtures/` is the reviewable behavior change.
3. For UI flows, add a scenario file in `spec/scenarios/core/`, put any new selectors in `spec/test-ids.json`, and run `pnpm spec:generate`. Use `TEST_IDS` in components; never hard-code test IDs.
4. Every platform must pass the new fixtures and scenarios, or the feature's/scenario's `status` must mark it `missing` and the PR must link a follow-up ticket.
   Native fixture ops go in their own file too: `apps/ios/TodoCore/Tests/TodoCoreTests/FixtureOps+<Feature>.swift` and `apps/android/core/src/test/kotlin/.../<Feature>FixtureOps.kt`, plus one line in the alphabetical registry. Keep shared lists (test IDs, step handlers, registries) one entry per line in alphabetical order so parallel PRs don't conflict; give a feature its own `<feature>Constants` op instead of adding to `constants`.
5. All of the verify commands above pass.
6. The PR includes Before/After media for each affected platform (`.github/pull_request_template.md`).

## Conventions

- Keep domain logic pure. Pass `now` in rather than reading the clock, so fixtures stay deterministic.
- Storage key `todo-tracker:todos:v1`; its format is defined by `spec/schema/storage.schema.json`.
- PR titles: `<type>(REED-n): …`. PR bodies start with the Linear ticket's name as a link, `[REED-n: Title](https://linear.app/...)`, then `Fixes REED-n`.
