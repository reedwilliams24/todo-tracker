# mobile

Expo (React Native, TypeScript) client for Todo Tracker. All todo logic and the
storage contract come from `@todo/shared`; this package only holds React Native
UI and the AsyncStorage adapter (`src/lib/storage.ts`).

```bash
pnpm --filter mobile start      # Expo dev server; press i / a or scan with Expo Go
pnpm --filter mobile ios
pnpm --filter mobile android
pnpm --filter mobile lint
pnpm --filter mobile typecheck
```
