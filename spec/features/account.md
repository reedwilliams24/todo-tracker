# Account and cloud storage

Fixtures: [`../fixtures/account.json`](../fixtures/account.json). Table: [`../../supabase/migrations`](../../supabase/migrations).

## Rules

- Accounts are optional. A client turns on sign-in only when both the public Supabase URL and anon key are configured (`cloudConfig` returns `null` otherwise). With no config the app is local-only and shows no sign-in UI.
- Only the anon key ships to clients. Row-level security limits every row to its owner.
- Sign-in methods: email (web follows the magic link; iOS and Android type the 6-digit code from the same email), Google and Apple (OAuth in the browser, redirecting to `todotracker://auth` on mobile).
- Signed in, the list is stored in the `todos` table, one row per todo (`toRow`): `id`, `user_id`, the whole todo as `data`, plus `completed`, `due_date` (`null` when unset, so an upsert clears it) and `updated_at` mirrored for querying. Loading reads the user's rows; signing out switches back to the device's local list.
- A save sends only what changed since the last load or save (`planCloudSave`): todos that are new or whose `updatedAt` differs from the last-synced version are upserted, and last-synced ids missing from the list are deleted.
- On the first sign-in on a device, the signed-out local list is merged into the account once (`mergeLocalIntoAccount`): the account's order is kept, local-only todos are appended, and on an id collision the local copy wins only if its `updatedAt` is strictly newer. The merged list is saved, then the per-account flag `migrationKey(userId)` is set so later sign-ins don't merge again.
