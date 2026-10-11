# Realtime

Fixtures: [`../fixtures/realtime.json`](../fixtures/realtime.json). Ticket: REED-70 (parent plan REED-61).

Live updates for a signed-in client over the Supabase Realtime websocket. Rows arriving here go through the [sync](sync.md) rules (`applyRemote`, `advanceCursor`); this feature only covers the connection. The banner and read-only mode on top of the connection state (REED-71) are under [Connection status](#connection-status).

## Channel

- **One socket, one channel.** Each tab / app instance has one connection manager. It owns exactly one Realtime socket and one channel, `realtimeTopic(userId).channel` (`todos:<uid>`). The channel listens to `postgres_changes` on `realtimeConstants.schema`.`realtimeConstants.table` (`public.todos`), every event, filtered with `realtimeTopic(userId).filter` (`user_id=eq.<uid>`). RLS scopes it again on the server.
- Deletes are tombstones (`deleted_at` set), so they arrive as updates. The new row of each insert/update is handed to `applyRemote([row])`, which advances the cursor. Echoes of the client's own pushes and rows at or below the cursor are ignored there.

## Lifecycle

- **`connect()` is idempotent.** Calling it again for the same user while connecting or connected does nothing (no second socket or channel). If a reconnect is waiting on its backoff timer, it retries now instead. Calling it for a different user disconnects first.
- **Connect sequence:** state becomes `connecting`; refresh the access token if needed and hand it to the socket; open the socket and join the channel; then `pull()` from the cursor. Rows that arrive while the pull runs are held and applied right after it. Then state becomes `connected`.
- **Disconnect** (`offline`): leave the channel and close the socket. It happens when the app goes to the background (web `visibilitychange` → `hidden`, iOS `scenePhase` `.background`, Android `ProcessLifecycleOwner` `ON_STOP`), on sign out and when the account scope goes away.
- **Foreground** (web `visible`, iOS `.active`, Android `ON_START`) and network recovery (web `online`) call `connect()`.
- **Failures:** if any step fails, or the channel drops after joining, the socket and channel are closed and state stays `connecting`. Attempt `n` (0-based) is retried after `reconnectDelayMs(n)`: `reconnectBaseMs` doubled per attempt, capped at `reconnectMaxMs`. A successful connect resets the attempt count.

## State

The manager exposes a stream of `ConnectionState`: `offline`, `connecting` or `connected`. Signed-out (guest) clients and builds without Supabase config have no manager, and behave exactly as before.

## Connection status

What a client shows about its connection, from four inputs: whether the shown list is an **account** list (signed in, or the session expired) rather than the guest list, whether the session **expired**, whether the device is **online**, and the manager's **connection** state (none when there is no manager).

- `connectionStatus` picks the first that applies: not an account list → `guest`; session expired → `expired`; no network → `offline`; connection `connected` → `connected`; anything else → `reconnecting`.
- `canEdit(status)` is true only for `guest` and `connected`. `connected` is only set after the cursor pull finishes (see the connect sequence), so the list is read-only until it has caught up.
- **Banner** (`connectionBanner`): `reconnecting` shows `connection.reconnecting` with a spinner and the `connection.readOnly` hint; `offline` shows `connection.offline`. `expired` shows the existing session-expired banner (sign in again) instead; `guest` and `connected` show nothing. The guest list never shows a connection state.
- **While `canEdit` is false** the cached list stays visible, but add, edit (rename, subtasks), complete, delete (row, bulk, clear completed), reorder, undo and voice add are disabled, using each platform's disabled state so assistive tech reports them as unavailable. Select mode is left. Filtering, search, sort and stats still work.
- **Online state** comes from the platform: web `navigator.onLine` with `online`/`offline` events, iOS `NWPathMonitor`, Android `ConnectivityManager` default-network callbacks. Getting the network back calls `connect()`, which retries now instead of waiting for the backoff timer.
