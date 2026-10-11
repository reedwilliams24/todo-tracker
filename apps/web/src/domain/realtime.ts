/** Live updates over the Supabase Realtime socket. Rules: spec/features/realtime.md. */

export type ConnectionState = "offline" | "connecting" | "connected";

export const REALTIME_SCHEMA = "public";
export const REALTIME_TABLE = "todos";
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30_000;

/** The one channel a signed-in client joins, and the postgres_changes filter that scopes it to the user. */
export function realtimeTopic(userId: string): { channel: string; filter: string } {
  return { channel: `${REALTIME_TABLE}:${userId}`, filter: `user_id=eq.${userId}` };
}

/** Delay before reconnect attempt `attempt` (0-based): doubles from the base, capped at the max. */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(Math.max(attempt, 0), 16));
}

/** What the signed-in list shows about its connection. `guest`: the local-only guest list, which never shows one. */
export type ConnectionStatus = "guest" | "connected" | "reconnecting" | "offline" | "expired";

export type ConnectionInput = {
  /** The shown list is an account's (signed in, or the session expired), not the guest list. */
  account: boolean;
  /** The session expired; the user has to sign in again. */
  expired: boolean;
  /** The device has a network connection. */
  online: boolean;
  /** The live connection's state; null when there is none. */
  connection: ConnectionState | null;
};

/** The connection banner's state (spec/features/realtime.md#connection-status). */
export function connectionStatus({ account, expired, online, connection }: ConnectionInput): ConnectionStatus {
  if (!account) return "guest";
  if (expired) return "expired";
  if (!online) return "offline";
  return connection === "connected" ? "connected" : "reconnecting";
}

/** Add, edit, complete, delete and voice add are allowed only on the guest list or a connected, caught-up account list. */
export function canEdit(status: ConnectionStatus): boolean {
  return status === "guest" || status === "connected";
}
