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
