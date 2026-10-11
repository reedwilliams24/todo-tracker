import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RealtimeConnection } from "@/lib/realtime";
import { createSupabaseRealtimeTransport } from "@/lib/realtime-transport";

// Referenced literally so Next inlines them at build time. Unset = guest-only build.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;
let realtime: RealtimeConnection | null = null;

/** The one Supabase client for this tab; null on the server or in an unconfigured build. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey || typeof window === "undefined") return null;
  client ??= createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** The tab's one Realtime connection manager; null when `getSupabase()` is. */
export function getRealtimeConnection(): RealtimeConnection | null {
  const supabase = getSupabase();
  if (!supabase) return null;
  realtime ??= new RealtimeConnection(createSupabaseRealtimeTransport(supabase));
  return realtime;
}
