# Accounts: email-code sign-in

Fixtures: [`../fixtures/auth.json`](../fixtures/auth.json). Server contract: [`../server.md`](../server.md). Sync rules: [`sync.md`](sync.md).

Builds without Supabase config (web `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, iOS `SUPABASE_URL`/`SUPABASE_ANON_KEY` in Info.plist, Android `BuildConfig.SUPABASE_URL`/`SUPABASE_ANON_KEY`) are guest-only: none of the UI below renders and the app behaves as before.

## Rules

- Sign-in is passwordless: email → **Send code** → 6-digit code → signed in. Supabase Auth sends the code (`signInWithOtp`, users are created on first sign-in) and checks it (`verifyOtp`, type `email`). Codes expire after 10 minutes (`otp_expiry = 600`).
- Emails are trimmed and lower-cased before use. An email must look like `x@y.z` (no spaces, one `@`, a dot in the domain); otherwise Send code shows `invalidEmail` without calling the server.
- Code input keeps only digits (pasting `123 456` gives `123456`) and at most 6 of them. **Verify** is disabled until there are exactly 6 digits.
- After a code is sent, **Resend** is disabled for 60 s and shows the seconds left (rounded up). The form can go back to the email step (**Use a different email**) or be cancelled.
- Only one request runs at a time: Send code/Verify while one is in flight are ignored.
- Errors, mapped from the HTTP status and Supabase `error_code` (`authErrorKind`):
  - no response (network failure) → `offline`
  - `429`, `over_email_send_rate_limit`, `over_request_rate_limit` → `rateLimited`
  - `otp_expired`, `invalid_credentials`, `otp_disabled`, or a `403` → `wrongCode` (Supabase does not distinguish wrong from expired codes)
  - `email_address_invalid`, `validation_failed` → `invalidEmail`
  - anything else → `unknown`
- The session persists across restarts and refreshes itself: web uses supabase-js's default `localStorage`, iOS supabase-swift's default Keychain storage, Android an `EncryptedSharedPreferences` session manager.
- A sign-out the user did not ask for (the refresh token is rejected) moves a signed-in client to `expired`: a "Sign in again" banner shows, the account's local list stays, and signing back in as the same user keeps it. Signing in as a different user wipes it first.
- Signing in while the guest list is non-empty asks "Move your N guest todos to your account?" with **Move** and **Discard**. The guest list is wiped either way. Move hands the guest todos to the `GuestTodoMover` seam (REED-68 implements it with `guestToRows` + push; until then it keeps them as the account's local list). Discard drops them.
- Sign out (account menu → **Sign out**) closes the auth/realtime connection, wipes the account's local list and sync cursor, and leaves an empty guest list.
- Delete account (account menu → **Delete account**, only while signed in) opens a confirmation dialog: "Delete your account?" naming the signed-in email, with **Cancel** and **Delete account**. Confirming calls the `delete_account` RPC ([`../server.md`](../server.md)), which deletes the user's todos and auth user on the server. On success the device ends the session locally and ends up exactly as after sign out: account list and sync cursor wiped, empty guest list. On failure (e.g. `offline`) nothing is deleted, the dialog stays open and shows the mapped `auth.error.*` message. Apple requires this for apps with sign-in.
- Signed out, a persistent banner reads "Guest mode: todos stay on this device. Sign in to sync." with a **Sign in** button. Signed in, the header shows the account menu (email + Sign out).
- Each platform keeps auth in one module (`AuthClient` on web/Android, `AuthService` on iOS) exposing the user id, access token and a signed-in/out state stream; UI state goes through the pure `reduceAuth` reducer.

## Reducer

State: `status` (`signedOut` | `signedIn` | `expired`), `step` (`email` | `code` | null when the form is closed), `email`, `userId`, `busy`, `error`, `resendAt` (epoch ms), `movePrompt` (guest count or null).

| Event                                 | Effect                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `open` / `cancel`                     | form opens at `email` / closes; clears `busy`, `error`                                                     |
| `sendCode(email)`                     | ignored while busy; invalid email → `error: invalidEmail`; else `busy`                                     |
| `codeSent(now)`                       | `step: code`, `resendAt = now + 60000`, clears `busy`, `error`                                             |
| `verify(code)`                        | ignored while busy or unless 6 digits; else `busy`                                                         |
| `failed(error)`                       | clears `busy`, sets `error`                                                                                |
| `changeEmail`                         | back to `step: email`                                                                                      |
| `signedIn(userId, email, guestCount)` | `status: signedIn`, form closed, `movePrompt = guestCount` if > 0                                          |
| `guestResolved`                       | `movePrompt: null`                                                                                         |
| `signedOut(initiated)`                | initiated or already signed out → initial state; otherwise `status: expired`, keeping `email` and `userId` |

## Scenarios

`spec/scenarios/core/sign-in-*.json` set `"requires": "supabase"`: they run only against a configured build and local `supabase start` (codes read from Mailpit). The web runner skips them otherwise; the Maestro generator skips them.
