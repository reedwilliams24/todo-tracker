# Account and cloud storage

Fixtures: [`../fixtures/account.json`](../fixtures/account.json). Table: [`../../supabase/migrations`](../../supabase/migrations).

## Rules

- Accounts are optional. A client turns on sign-in only when both the public Supabase URL and anon key are configured (`cloudConfig` returns `null` otherwise). With no config the app is local-only and shows no sign-in UI.
- Only the anon key ships to clients. Row-level security limits every row to its owner.
- Sign-in methods: email (web follows the magic link; iOS and Android type the 6-digit code from the same email), Google and Apple (OAuth in the browser, redirecting to `todotracker://auth` on mobile).
- Signed in, the list is stored in the `todos` table, one row per todo (`toRow`): `id`, `user_id`, the whole todo as `data`, plus `completed`, `due_date` (`null` when unset, so an upsert clears it) and `updated_at` mirrored for querying. Loading reads the user's rows; signing out switches back to the device's local list.
- A save sends only what changed since the last load or save (`planCloudSave`): todos that are new or whose `updatedAt` differs from the last-synced version are upserted, and last-synced ids missing from the list are deleted.
- On the first sign-in on a device, the signed-out local list is merged into the account once (`mergeLocalIntoAccount`): the account's order is kept, local-only todos are appended, and on an id collision the local copy wins only if its `updatedAt` is strictly newer. The merged list is saved, then the per-account flag `migrationKey(userId)` is set so later sign-ins don't merge again.

## Live sync

- Signed in, every client subscribes after the first load to Supabase Realtime `postgres_changes` on its own rows: channel `realtimeTopic(userId)` (`todos:<userId>`), filter `todoChangeFilter(userId)` (`event: "*"`, `public.todos`, `user_id=eq.<userId>`). The migration adds `public.todos` to the `supabase_realtime` publication, and RLS applies to the feed. Signed out there is no subscription.
- On a change event the client reloads the account's rows and folds them into its list with `mergeRemoteTodos(local, remote, known)`, where `known` is the last-synced snapshot. A burst of events triggers one reload, and reloads and saves run one at a time.
  - A todo in both lists takes the remote copy, unless the local `updatedAt` differs from the last-synced one (an unsaved local edit), which wins.
  - A local todo missing remotely is dropped if it was synced (deleted elsewhere) and kept if it wasn't (an unsaved local add).
  - A remote todo missing locally is added if it was never synced (added elsewhere) and stays deleted if it was (an unsaved local delete). Added todos go first, newest `createdAt` first. Otherwise local order is kept.
  - `changed` is false when the result has the same ids and `updatedAt`s in the same order as the local list; then the UI is left alone, so the echo of the device's own save is a no-op. After the merge `known` becomes the remote snapshot, so the next save sends only the unsaved local changes.
- Mobile clients reconnect after the socket drops (with a fresh access token) and reload once the channel is joined, so changes made while offline show up.
- The signed-in panel reads "Signed in as <email> · syncing across devices".
