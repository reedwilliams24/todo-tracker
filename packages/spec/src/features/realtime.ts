import {
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
  ],
};

export const ops: Ops = {
  realtimeConstants: () => ({
    schema: REALTIME_SCHEMA,
    table: REALTIME_TABLE,
    reconnectBaseMs: RECONNECT_BASE_MS,
    reconnectMaxMs: RECONNECT_MAX_MS,
  }),
  realtimeTopic: (g) => realtimeTopic(g.userId),
  reconnectDelayMs: (g) => reconnectDelayMs(g.attempt),
};
