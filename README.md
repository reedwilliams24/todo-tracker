# todo-tracker

A todo tracker for web, iOS and Android. Each client implements the domain
logic natively (TypeScript, Swift, Kotlin), and all three are checked against
the same conformance fixtures in [`spec/`](spec/README.md).

## Try the latest build

**Web:** https://todo-tracker-puce.vercel.app

Every merge to `main` ships automatically to the platforms it touches
([#39](https://github.com/reedwilliams24/todo-tracker/issues/39)):

| Changed paths                                     | What deploys                                     |
| ------------------------------------------------- | ------------------------------------------------ |
| `apps/web/**`                                     | Web → Vercel production (PRs get a preview link) |
| Root config (`package.json`, lockfile, workspace) | Web                                              |
| `supabase/migrations/**`                          | Database → Supabase dev, then prod               |

- **Web:** _URL goes here after the first deploy._
- **Android / iOS:** no install channel yet ([REED-74](https://linear.app/reed-williams/issue/REED-74), [REED-75](https://linear.app/reed-williams/issue/REED-75)). Build from [`apps/android`](apps/android/README.md) or [`apps/ios`](apps/ios/README.md); CI uploads a debug APK on every run.

## Structure

```
apps/web        Next.js 15 (App Router) + Tailwind web client; src/domain
                holds its todo logic, storage contract and `useTodos` hook
apps/ios        Swift / SwiftUI app (SwiftData)
apps/android    Kotlin / Jetpack Compose app (Room)
packages/spec   fixture recorder, TS fixture runner and parity matrix
spec            language-neutral rules, fixtures, test IDs and UI scenarios
supabase        backend: Postgres migrations, pgTAP tests, auth config and email template
```

Storage is local-first: todos persist to `localStorage` on web, SwiftData on
iOS and Room on Android, so there is no backend or database to run yet. On web
the adapter implements the `TodoStorage` interface from `apps/web/src/domain`;
swapping in an API later means adding another adapter next to
`apps/web/src/lib/storage.ts`.

## Voice input

Hit the mic, say what you need to do, and stop talking: after five seconds of
silence the browser's Web Speech API transcript goes to `POST /api/parse-todos`
and the resulting todos are added straight to the list, with an Undo. The model
also assigns each todo a priority, calibrated against your open todos; a due
date is only set if you actually said one.

Parsing uses a local [Ollama](https://ollama.com) model, with a regex parser in
`apps/web/src/domain/voice.ts` as the fallback whenever Ollama is unreachable or returns
nothing — so the feature works with no setup, just less accurately.

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b
```

| Variable            | Default                  | Purpose                                 |
| ------------------- | ------------------------ | --------------------------------------- |
| `OLLAMA_URL`        | `http://127.0.0.1:11434` | Ollama endpoint                         |
| `OLLAMA_MODEL`      | `llama3.2:3b`            | Model used for parsing                  |
| `OLLAMA_TIMEOUT_MS` | `20000`                  | Per-request timeout before falling back |

Speech recognition needs a Chromium-based browser; elsewhere the transcript box
accepts typed input.

## Getting started

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm dev          # web app on http://localhost:3000
```

### Mobile

See [`apps/android/README.md`](apps/android/README.md) (Gradle, emulator) and
[`apps/ios/README.md`](apps/ios/README.md) (Xcode, Simulator). Voice input is
web-only for now.

### Backend (Supabase)

Accounts and sync (REED-61) use Supabase. The schema, RLS and the `push_todos` RPC live in
`supabase/migrations`; the contract clients code against is in
[`spec/server.md`](spec/server.md). Running it locally needs Docker:

```bash
pnpm exec supabase start   # local stack; prints the API URL and anon key
pnpm exec supabase db reset  # re-apply supabase/migrations from scratch
pnpm exec supabase test db   # pgTAP tests in supabase/tests
```

Sign-in codes sent locally land in Mailpit at http://127.0.0.1:54324. Auth settings (6-digit email
code, 10-minute expiry, 60 s resend) are in `supabase/config.toml`, and the code-only email template
is `supabase/templates/otp-code.html`.

#### Local, dev and prod

| Backend | Project                                | Used by                                                  |
| ------- | -------------------------------------- | -------------------------------------------------------- |
| local   | `pnpm exec supabase start` (Docker)    | `pnpm dev` via `.env.local`, CI's `db-tests-supabase`    |
| dev     | hosted `todo-tracker-dev` (us-east-1)  | Vercel preview deployments                               |
| prod    | hosted `todo-tracker-prod` (us-west-2) | Vercel production (https://todo-tracker-puce.vercel.app) |

The web app picks its backend from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(the publishable key, never the `service_role` one). Vercel sets them per environment: Preview gets dev,
Production gets prod. To run the web app against a backend locally, put that backend's values in
`apps/web/.env.local` (git-ignored) and run `pnpm dev`:

- local: the API URL and anon key that `supabase start` prints (`pnpm exec supabase status` shows them again)
- dev / prod: the Project URL and publishable key from
  https://supabase.com/dashboard/project/_/settings/api-keys

With neither variable set the app stays guest-only (local storage). Native app config is below.

#### Building the apps against Supabase

Sign-in (REED-66) only appears when a build has a Supabase URL and publishable (anon) key. Default and
CI builds have none, so they stay guest-only. The URL and key are public; never use a service-role key.

| Target                   | Web                                                                                                                                | iOS                                                                                                                                        | Android                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Local (`supabase start`) | `apps/web/.env.local` with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY>` | `apps/ios/Config/Supabase.override.xcconfig` (git-ignored) with `SUPABASE_URL = http:/$()/127.0.0.1:54321` and `SUPABASE_ANON_KEY = <key>` | `./gradlew :app:assembleDebug -PsupabaseUrl=http://10.0.2.2:54321 -PsupabaseAnonKey=<key>` |
| Dev                      | Vercel Preview env                                                                                                                 | `Supabase.override.xcconfig` containing `#include "Supabase.dev.xcconfig"`                                                                 | `-PsupabaseEnv=dev`                                                                        |
| Prod                     | Vercel Production env                                                                                                              | `#include "Supabase.prod.xcconfig"`                                                                                                        | `-PsupabaseEnv=prod`                                                                       |

`<PUBLISHABLE_KEY>` comes from `pnpm exec supabase status -o env`. Dev/prod values are committed in
`apps/ios/Config/Supabase.{dev,prod}.xcconfig` and `apps/android/config/supabase-{dev,prod}.properties`;
they come from the Management API (`GET /v1/projects/{ref}/api-keys`, the `sb_publishable_` key).
Android debug builds allow cleartext HTTP to `10.0.2.2`/`localhost` only, for the local stack. Web e2e
against the local stack: `pnpm --filter web e2e:auth` (reads codes from Mailpit).

#### Migrations on hosted projects

Merging a change under `supabase/migrations/` to `main` runs
[`.github/workflows/supabase-migrations.yml`](.github/workflows/supabase-migrations.yml): `deploy-supabase-dev`
applies the new migrations to dev, and only if that succeeds `deploy-supabase-prod` applies them to prod. It
can also be started by hand from https://github.com/reedwilliams24/todo-tracker/actions/workflows/supabase-migrations.yml
(**Run workflow**). Both jobs run [`scripts/supabase-db-push.sh`](scripts/supabase-db-push.sh), which calls
`supabase db push --db-url` through the session pooler (the direct database host is IPv6-only), using the
`SUPABASE_{DEV,PROD}_PROJECT_REF` and `SUPABASE_{DEV,PROD}_DB_PASSWORD` repo secrets; no access token is
stored in CI. The workflow isn't a PR check: `db-tests-supabase` tests migrations on PRs. Migrations are
forward-only, so fix a bad one with a new migration rather than editing a merged file.

To see what would be applied without changing anything:

```bash
PROJECT_REF=<ref> DB_PASSWORD=<password> POOLER_HOST=aws-0-us-east-1.pooler.supabase.com \
  scripts/supabase-db-push.sh --dry-run   # prod: aws-1-us-west-2.pooler.supabase.com
```

#### Auth settings on hosted projects

`supabase/config.toml` only configures the local stack. The hosted projects get the same auth settings
(email code only, 6 digits, 10-minute expiry, 60 s resend, sign-ups on, 30 emails/hour, the code-only
template for the confirmation and magic-link emails) plus each project's site URL and redirect allow-list
from [`scripts/supabase-auth-config.mjs`](scripts/supabase-auth-config.mjs), through the Management API.
Re-run it after changing the template or any of those settings:

```bash
pnpm supabase:auth-config dev prod --dry-run   # list the settings that differ
pnpm supabase:auth-config dev prod             # apply them
```

It needs `SUPABASE_ACCESS_TOKEN` (a scoped token with Auth Config + Project Settings read-write) and
`SUPABASE_{DEV,PROD}_PROJECT_REF`. It never sends SMTP fields, so the Gmail SMTP configured in each project
(sign-in codes are sent from Reed's Gmail until [REED-78](https://linear.app/reed-williams/issue/REED-78)) is
left as is; after applying it prints whether each SMTP field is still set, never the values.

## Checks

```bash
pnpm lint           # ESLint (web)
pnpm lint:ios       # SwiftLint (needs `swiftlint`; Android lint runs in CI via `:app:lintDebug`)
pnpm format:check   # Prettier (web, docs, config) + ktfmt (Android) + swift-format (iOS)
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format` rewrites files in place; `format:web`, `format:android` and `format:ios` run one
formatter. Kotlin uses Meta's ktfmt (kotlinlang style) through the Spotless Gradle plugin. Swift
uses Apple's swift-format (`swift format`, part of the Swift 6 toolchain, configured in
`.swift-format`). All three use a 120-column limit. Generated files (`spec/fixtures/`, the Maestro
flows, `test-ids`) are excluded from Prettier because `spec:check` compares them byte-for-byte.

## CI

`.github/workflows/ci.yml` runs two tiers:

| Tier        | Jobs                                                                                                                                   | When                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Fast checks | `lint-web` (ESLint), `lint-android` (Android lint), `lint-ios` (SwiftLint), `typecheck`, `spec`                                        | every PR and push (`lint-android` / `lint-ios` when their files change) |
| Formatting  | `format-web` (Prettier), `format-android` (ktfmt via Spotless), `format-ios` (swift-format, `swift:6.1.2` container)                   | every PR and push (android / ios only when their files change)          |
| Unit tests  | `unit-tests-web` (vitest + TS fixture runner), `unit-tests-android` (`:core:test`), `unit-tests-ios` (`swift test`)                    | every PR, only for the platforms the PR touches                         |
| DB tests    | `db-tests-supabase` (`supabase start` + `db reset` + `test db`: pgTAP tests of the schema, RLS and `push_todos`)                       | every PR that touches `supabase/` or shared files                       |
| Builds      | `build-web` (`next build`), `build-android` (debug APK), `build-ios` (Simulator build of the SwiftUI app, when the app target changes) | every PR, only for the platforms the PR touches                         |
| E2E tests   | `e2e-tests-web` (Playwright), `e2e-tests-android` (Maestro on an emulator), `e2e-tests-ios` (XCUITest + Maestro on the Simulator)      | push to `main` (or `workflow_dispatch` with `e2e: true`)                |

Platform detection: files under `apps/<platform>` count for that platform only; everything
else (`spec/`, `packages/`, root config, workflows) counts for all three.

The `main` ruleset requires exactly one check, `Required CI Checks` (job `ci`): a gate job that passes when every PR
job passed or was skipped by the path filter. Jobs can be added, split or renamed in
`ci.yml` without editing the ruleset (which the Devin app can't do; see
`scripts/protect-main.sh` for the one-time UI steps). E2E jobs are not required: they run
after merge, and a failure on `main` is fixed in a follow-up PR.

## Pull requests

Every change is expected to land on all three platforms (web, iOS, Android).
The PR template has a Before/After table per platform; fill each one in or mark
it "N/A — not affected" with a one-line reason. The description starts with the
Linear ticket's name as a link, followed by `Fixes REED-n`.

## Deploying

### Web (Vercel)

Vercel's GitHub integration deploys `apps/web` to https://todo-tracker-puce.vercel.app: production on every push to `main`, a preview (linked on
the PR) for pull requests. [`apps/web/vercel.json`](apps/web/vercel.json) has an `ignoreCommand` that skips
the build unless `apps/web/**` or the root package/lockfile/workspace config changed, so native-only
changes don't deploy.

One-time setup (already done; nothing is committed): [vercel.com/new](https://vercel.com/new) → import
`reedwilliams24/todo-tracker` → Root Directory `apps/web` → Deploy. Vercel detects the pnpm workspace and
installs from the repo root.
