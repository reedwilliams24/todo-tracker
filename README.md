# todo-tracker

A todo tracker for web, iOS and Android — shared domain logic lives in a
workspace package so all clients stay in sync.

## Try the latest build

Every merge to `main` ships automatically to the platforms it touches
([#39](https://github.com/reedwilliams24/todo-tracker/issues/39)):

| Changed paths | What deploys |
| --- | --- |
| `apps/web/**` only | Web → Vercel production ([`deploy-web.yml`](.github/workflows/deploy-web.yml)) |
| `apps/mobile/**` only | Mobile alpha → EAS build; Android APK to Firebase App Distribution, iOS via EAS internal ([`deploy-mobile.yml`](.github/workflows/deploy-mobile.yml)) |
| `packages/shared/**` or root config (`package.json`, lockfile, workspace) | Both |

- **Web:** https://todo-tracker.vercel.app <!-- replace with the production URL Vercel assigns after the first deploy -->
- **Android alpha:** ask the owner to add your email to the `alpha` tester group in Firebase App Distribution; you'll get an invite email with the install link, and new builds notify you automatically.
- **iOS alpha:** register your device with `eas device:create` (owner runs it, or shares the QR link), then install from the build link in the "Mobile alpha" workflow run / EAS dashboard.

Both workflows are inert until their repository secrets/variables are set (web:
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, var `VERCEL_ENABLED=true`;
mobile: `EXPO_TOKEN`, `FIREBASE_ANDROID_APP_ID`, `FIREBASE_SERVICE_ACCOUNT`, var
`MOBILE_ALPHA_ENABLED=true`). Check the Actions tab to confirm a merge only triggered
the workflow(s) for the platform it changed.

## Structure

```
apps/web        Next.js 15 (App Router) + Tailwind web client
apps/mobile     Expo (React Native) iOS + Android client
packages/shared platform-agnostic types, todo logic, storage contract and
                the `useTodos` hook (@todo/shared, @todo/shared/react)
```

Storage is local-first: todos persist to `localStorage` on web and
`AsyncStorage` on mobile, so there is no backend or database to run yet. Both
adapters implement the `TodoStorage` interface from `@todo/shared`; swapping in
an API later means adding another adapter (`apps/web/src/lib/storage.ts`,
`apps/mobile/src/lib/storage.ts`) and keeping `@todo/shared` unchanged.

## Voice input

Hit the mic, say what you need to do, and stop talking: after five seconds of
silence the browser's Web Speech API transcript goes to `POST /api/parse-todos`
and the resulting todos are added straight to the list, with an Undo. The model
also assigns each todo a priority, calibrated against your open todos; a due
date is only set if you actually said one.

Parsing uses a local [Ollama](https://ollama.com) model, with a regex parser in
`@todo/shared` as the fallback whenever Ollama is unreachable or returns
nothing — so the feature works with no setup, just less accurately.

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used for parsing |
| `OLLAMA_TIMEOUT_MS` | `20000` | Per-request timeout before falling back |

Speech recognition needs a Chromium-based browser; elsewhere the transcript box
accepts typed input.

## Getting started

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm dev          # web app on http://localhost:3000
```

### Mobile

```bash
pnpm --filter mobile start      # Expo dev server
pnpm --filter mobile ios        # iOS simulator (macOS + Xcode)
pnpm --filter mobile android    # Android emulator / device
```

From the dev server you can also scan the QR code with
[Expo Go](https://expo.dev/go). Voice input is web-only for now.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Required CI checks

`main` is protected: a PR can only be merged once the `lint`, `typecheck`,
`test`, `build` and `e2e` jobs from `.github/workflows/ci.yml` have passed on
the latest commit, and the branch is up to date with `main`. Pending or failing
checks block the merge button.

The rule is applied with `scripts/protect-main.sh` (needs repo admin). Keep the
job names in that script in sync with the workflow.

## Pull requests

Every change is expected to land on all three platforms (web, iOS, Android).
The PR template has a Before/After table per platform; fill each one in or mark
it "N/A — not affected" with a one-line reason.
