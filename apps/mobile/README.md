# Mobile app (placeholder)

The mobile client will live here (planned: Expo + React Native).

It will consume the same domain logic and types as the web app from
`@todo/shared`, so keep platform-agnostic logic in that package rather than in
`apps/web`.

## Planned setup

```bash
pnpm dlx create-expo-app@latest . --template blank-typescript
```

Then add `"@todo/shared": "workspace:*"` to its dependencies.
