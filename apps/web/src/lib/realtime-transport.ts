import type { SupabaseClient } from "@supabase/supabase-js";
import { REALTIME_SCHEMA, REALTIME_TABLE, realtimeTopic, type TodoRow } from "@/domain";
import type { RealtimeTransport } from "@/lib/realtime";

const REFRESH_MARGIN_S = 60;

/** `RealtimeTransport` on supabase-js: one socket (`client.realtime`) and one channel per connect. */
export function createSupabaseRealtimeTransport(client: SupabaseClient): RealtimeTransport {
  return {
    async refreshAuth() {
      let { data, error } = await client.auth.getSession();
      if (error) throw error;
      const expiresAt = data.session?.expires_at ?? 0;
      if (data.session && expiresAt - Date.now() / 1000 < REFRESH_MARGIN_S) {
        ({ data, error } = await client.auth.refreshSession());
        if (error) throw error;
      }
      if (!data.session) throw new Error("signed out");
      await client.realtime.setAuth(data.session.access_token);
    },
    open(userId, handlers) {
      const { channel: name, filter } = realtimeTopic(userId);
      const channel = client.channel(name);
      const close = async () => {
        await client.removeChannel(channel);
        client.realtime.disconnect();
      };
      return new Promise((resolve, reject) => {
        let joined = false;
        channel
          .on("postgres_changes", { event: "*", schema: REALTIME_SCHEMA, table: REALTIME_TABLE, filter }, (payload) => {
            if (payload.eventType !== "DELETE") handlers.onRow(payload.new as TodoRow);
          })
          .subscribe((status, err) => {
            if (status === "SUBSCRIBED") {
              joined = true;
              resolve({ close });
            } else if (joined) {
              handlers.onClosed();
            } else {
              void close();
              reject(err ?? new Error(status));
            }
          });
      });
    },
  };
}
