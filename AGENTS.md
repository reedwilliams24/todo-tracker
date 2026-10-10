# AGENTS.md

Guide for humans and AI agents working in this repo.

## Architecture

- `apps/web`: Next.js 15 web client.
- `apps/mobile`: Expo / React Native client. It is being replaced by native apps (`apps/ios` in Swift/SwiftUI, `apps/android` in Kotlin/Compose; REED-27).
- `packages/shared`: TypeScript domain logic (todos, list ops, undo reducer `store.ts`, storage format, voice parser) and the generated `TEST_IDS`. Web and Expo use it directly.
- `packages/spec`: conformance tooling. It holds the fixture cases, the TS runner, code generation, and the parity matrix.
- `spec/`: the language-neutral contract every platform must satisfy. Start with [`spec/README.md`](spec/README.md).

Every product change applies to web, iOS and Android unless the ticket says otherwise. Native apps reimplement the logic in Swift and Kotlin. They don't share code; they share `spec/`.

## Verify

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test                 # includes the TS fixture runner (packages/spec)
pnpm spec:check           # fixtures and generated files are up to date
pnpm spec:parity          # web/iOS/Android parity matrix
pnpm build
pnpm --filter web e2e     # Playwright, incl. spec/scenarios/core.json
```

iOS (macOS + Xcode): `swift test` in `apps/ios/TodoCore` runs the fixtures; see [`apps/ios/README.md`](apps/ios/README.md) for the app.

Mobile scenarios: `maestro test --include-tags spec -e APP_ID=… spec/scenarios/maestro` (see `spec/README.md`).

## Definition of done for a behavior change

1. Update the rule in `spec/features/<feature>.md`.
2. Add or change cases in `packages/spec/src/cases.ts`, change the code, and run `pnpm spec:record`. The diff in `spec/fixtures/` is the reviewable behavior change.
3. For UI flows, add steps to `spec/scenarios/core.json`, put any new selectors in `spec/test-ids.json`, and run `pnpm spec:generate`. Use `TEST_IDS` in components; never hard-code test IDs.
4. Every platform must pass the new fixtures and scenarios, or `spec/platforms.json` must mark it `missing` and link a follow-up ticket.
5. All of the verify commands above pass.
6. The PR includes Before/After media for each affected platform (`.github/pull_request_template.md`).

## Conventions

- Keep domain logic pure. Pass `now` in rather than reading the clock, so fixtures stay deterministic.
- Storage key `todo-tracker:todos:v1`; its format is defined by `spec/schema/storage.schema.json`.
- PR titles: `<type>(REED-n): …`; PR bodies include `Fixes REED-n`.
