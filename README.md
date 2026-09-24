# todo-tracker

A todo tracker. Web first, mobile later — shared domain logic lives in a
workspace package so both clients stay in sync.

## Structure

```
apps/web        Next.js 15 (App Router) + Tailwind web client
apps/mobile     placeholder for the future React Native client
packages/shared platform-agnostic types + todo logic (@todo/shared)
```

Storage is local-first: todos persist to `localStorage`, so there is no backend
or database to run yet. Swapping in an API later means replacing the storage
layer in `apps/web/src/lib/storage.ts` and keeping `@todo/shared` unchanged.

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
