import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodoRow } from "@/domain";
import type { SyncServer } from "@/lib/sync-engine";

/** `push_todos` + the incremental pull from spec/server.md, as the signed-in user (RLS). */
export function createSupabaseSyncServer(supabase: SupabaseClient): SyncServer {
  return {
    async push(rows) {
      const { data, error } = await supabase.rpc("push_todos", { rows });
      if (error) throw error;
      return (data ?? []) as TodoRow[];
    },
    async pull(cursor, limit) {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .gt("server_seq", cursor)
        .order("server_seq")
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as TodoRow[];
    },
  };
}
