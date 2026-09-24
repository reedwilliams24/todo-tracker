import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cloudConfig, supabaseTodoTable, type Database, type TodoTable } from "@todo/shared";

const config = cloudConfig(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** `null` when the app runs local-only (no Supabase env configured). */
export const supabase: SupabaseClient<Database> | null = config
  ? createClient<Database>(config.url, config.anonKey)
  : null;

export function todoTable(client: SupabaseClient<Database>): TodoTable {
  return supabaseTodoTable({
    list: (userId) => client.from("todos").select("*").eq("user_id", userId),
    upsert: (rows) => client.from("todos").upsert(rows),
    remove: (userId, ids) => client.from("todos").delete().eq("user_id", userId).in("id", ids),
    onChange: (userId, callback) => {
      const channel = client
        .channel(`todos:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "todos", filter: `user_id=eq.${userId}` },
          callback,
        )
        .subscribe();
      return () => void client.removeChannel(channel);
    },
  });
}
