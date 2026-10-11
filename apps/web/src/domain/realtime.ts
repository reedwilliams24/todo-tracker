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
