import {
  canEdit,
  type ConnectionStatus,
  connectionStatus,
  REALTIME_SCHEMA,
  REALTIME_TABLE,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  realtimeTopic,
  reconnectDelayMs,
} from "web/domain";
import type { Feature, Ops } from "../types";

const USER = "6a1f1c2e-0000-4000-8000-000000000001";

export const feature: Feature = {
  feature: "realtime",
  spec: "features/realtime.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "realtimeConstants", given: {} },
    { name: "realtimeTopic: one channel per user, filtered on user_id", op: "realtimeTopic", given: { userId: USER } },
    ...[0, 1, 2, 3, 4, 5, 6, 40].map((attempt) => ({
      name: `reconnectDelayMs: attempt ${attempt}`,
      op: "reconnectDelayMs",
      given: { attempt },
    })),
    ...connectionCases(),
    ...(["guest", "connected", "reconnecting", "offline", "expired"] as ConnectionStatus[]).map((status) => ({
      name: `canEdit: ${status}`,
      op: "canEdit",
      given: { status },
    })),
  ],
};

/** Every combination of the connection-status inputs. `connection: null` is left out of `given` (no live connection). */
function connectionCases() {
  const cases = [];
  for (const account of [false, true])
    for (const expired of [false, true])
      for (const online of [true, false])
        for (const connection of [null, "offline", "connecting", "connected"] as const) {
          const given = { account, expired, online, ...(connection ? { connection } : {}) };
          cases.push({
            name: `connectionStatus: ${account ? "account" : "guest"}, ${expired ? "expired" : "session ok"}, ${online ? "online" : "no network"}, ${connection ?? "no connection"}`,
            op: "connectionStatus",
            given,
          });
        }
  return cases;
}

export const ops: Ops = {
  realtimeConstants: () => ({
    schema: REALTIME_SCHEMA,
    table: REALTIME_TABLE,
    reconnectBaseMs: RECONNECT_BASE_MS,
    reconnectMaxMs: RECONNECT_MAX_MS,
  }),
  realtimeTopic: (g) => realtimeTopic(g.userId),
  reconnectDelayMs: (g) => reconnectDelayMs(g.attempt),
  connectionStatus: (g) =>
    connectionStatus({ account: g.account, expired: g.expired, online: g.online, connection: g.connection ?? null }),
  canEdit: (g) => canEdit(g.status),
};
