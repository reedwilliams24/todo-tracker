# todo-tracker

A todo tracker for web, iOS and Android — shared domain logic lives in a
workspace package so all clients stay in sync.

## Try the latest build

Every merge to `main` ships automatically to the platforms it touches
([#39](https://github.com/reedwilliams24/todo-tracker/issues/39)):

| Changed paths | What deploys |
| --- | --- |
| `apps/web/**` | Web → Vercel production ([`deploy-web.yml`](.github/workflows/deploy-web.yml)) |
| `apps/android/**` | Android alpha → release APK to Firebase App Distribution ([`deploy-mobile.yml`](.github/workflows/deploy-mobile.yml)) |
| `apps/ios/**` | iOS alpha → TestFlight ([`deploy-mobile.yml`](.github/workflows/deploy-mobile.yml)) |
| `spec/**` | Both native apps |
| `packages/shared/**` or root config (`package.json`, lockfile, workspace) | Web |

- **Web:** https://todo-tracker.vercel.app <!-- replace with the production URL Vercel assigns after the first deploy -->
- **Android alpha:** ask the owner to add your email to the `alpha` tester group in Firebase App Distribution; you'll get an invite email with the install link, and new builds notify you automatically.
- **iOS alpha:** ask the owner to add you as a TestFlight tester; install the TestFlight app and accept the invite. New builds show up there.

Both workflows are inert until their repository secrets/variables are set (see
[Deploying](#deploying)). Check the Actions tab to confirm a merge only triggered
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
`test`, `spec`, `build`, `e2e`, `android` and `ios` jobs from `.github/workflows/ci.yml` have passed on
the latest commit, and the branch is up to date with `main`. Pending or failing
checks block the merge button.

The rule is applied with `scripts/protect-main.sh` (needs repo admin). Keep the
job names in that script in sync with the workflow.

## Pull requests

Every change is expected to land on all three platforms (web, iOS, Android).
The PR template has a Before/After table per platform; fill each one in or mark
it "N/A — not affected" with a one-line reason. The description starts with the
Linear ticket's name as a link, followed by `Fixes REED-n`.

## Deploying

### Web (Vercel)

Production: _not yet deployed — URL goes here after the first `main` deploy._

`.github/workflows/deploy-web.yml` deploys `apps/web` with the Vercel CLI: production on every push to
`main`, a preview (commented on the PR) for pull requests. It only runs when `apps/web/**`,
`packages/shared/**`, or the root package/lockfile/workspace config change — mobile-only changes skip it.
Vercel's own Git integration is disabled in `vercel.json` so the workflow is the single deploy path.

One-time setup (nothing is committed):

1. Create a Vercel project from the repo root (`vercel link` locally, or in the dashboard). Root directory
   stays the repo root; `vercel.json` points the build at `apps/web`.
2. Add repository secrets: `VERCEL_TOKEN` (Account → Tokens), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`
   (from `.vercel/project.json` after `vercel link`).
3. Add repository variable `VERCEL_ENABLED=true` to switch the workflow on.

### Mobile alpha (Firebase App Distribution + TestFlight)

`.github/workflows/deploy-mobile.yml` runs on every push to `main` that touches `apps/android/**`,
`apps/ios/**` or `spec/**` (or on a manual "Run workflow"). A `changes` job routes the build: Android-only
changes skip iOS and the other way round; `spec/**` builds both.

- **Android** (ubuntu): `./gradlew :core:test :app:assembleRelease`, then uploads
  `app-release.apk` to Firebase App Distribution tester group `alpha` with `firebase-tools`. The release
  build type signs with the debug key (see `apps/android/app/build.gradle.kts`); CI restores a fixed
  keystore from `ANDROID_DEBUG_KEYSTORE` so every build installs over the last one.
- **iOS** (macos-latest): `swift test` for the fixtures, `xcodegen generate`, `xcodebuild archive` with
  manual signing (team and profile are read from the provisioning profile; build number = workflow run
  number), `-exportArchive` to an App Store Connect IPA, then `xcrun altool --upload-app` to TestFlight
  with an App Store Connect API key. It has its own switch because TestFlight needs a paid Apple
  Developer account.

One-time setup (nothing is committed):

1. Firebase: create a project, add an Android app with package `com.reedwilliams24.todotracker`, enable
   App Distribution, create tester group `alpha`, and create a service account with the
   "Firebase App Distribution Admin" role (download its JSON key).
2. Android signing keystore (keep a copy; losing it means testers must uninstall once):
   `keytool -genkeypair -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`,
   then `base64 -w0 debug.keystore`.
3. Repository secrets for Android: `FIREBASE_APP_ID` (`1:…:android:…`, Project settings → Your apps),
   `FIREBASE_SERVICE_ACCOUNT` (the service-account JSON), `ANDROID_DEBUG_KEYSTORE` (base64 from step 2).
4. Repository variable `MOBILE_ALPHA_ENABLED=true` to switch the workflow on (Android only).
5. iOS, once there is a paid Apple Developer account: register bundle id `com.reedwilliams24.todotracker`
   and create the app in App Store Connect; create an Apple Distribution certificate (export it as `.p12`
   with a password) and an App Store provisioning profile for the bundle id; create an App Store Connect
   API key (Users and Access → Integrations, role "App Manager"). The app also needs an `AppIcon` asset
   catalog before App Store Connect will accept an upload.
6. Repository secrets for iOS: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (contents of the `.p8`),
   `IOS_DIST_CERT_P12_BASE64` (`base64 -i cert.p12`), `IOS_DIST_CERT_PASSWORD`,
   `IOS_PROVISIONING_PROFILE_BASE64` (`base64 -i profile.mobileprovision`); then repository variable
   `IOS_TESTFLIGHT_ENABLED=true`.
