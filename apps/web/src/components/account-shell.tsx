"use client";

import { useMemo } from "react";
import { AccountMenu, AuthBanner, MoveGuestTodosPrompt } from "@/components/account";
import { AppHeader } from "@/components/app-header";
import { TodoApp } from "@/components/todo-app";
import { useAuth } from "@/hooks/use-auth";
import { serverGuestTodoMover } from "@/lib/account";
import { createSupabaseAuthClient } from "@/lib/auth-client";
import { accountTodoStorage, localTodoStorage } from "@/lib/storage";
import { getRealtimeConnection, getSupabase, supabaseConfigured } from "@/lib/supabase";
import { createSupabaseSyncServer } from "@/lib/sync-server";

/** Daybook shell + list. Without Supabase config this is exactly the guest-only app. */
export function AccountShell() {
  if (!supabaseConfigured) {
    return <TodoApp />;
  }
  return <SignedInShell />;
}

function SignedInShell() {
  const supabase = useMemo(() => getSupabase(), []);
  const realtime = useMemo(() => getRealtimeConnection(), []);
  const client = useMemo(() => (supabase ? createSupabaseAuthClient(supabase, realtime) : null), [supabase, realtime]);
  const server = useMemo(() => (supabase ? createSupabaseSyncServer(supabase) : null), [supabase]);
  const mover = useMemo(() => serverGuestTodoMover(server!), [server]);
  const auth = useAuth(client, mover);
  const { status, userId, movePrompt } = auth.state;
  const scope = status === "signedOut" || movePrompt !== null ? "guest" : `account:${userId}`;
  const sessionUserId = auth.session?.userId ?? null;
  const sync = useMemo(
    () => (server && sessionUserId && scope !== "guest" ? { server, userId: sessionUserId, realtime } : null),
    [server, sessionUserId, scope, realtime],
  );
  if (!auth.ready) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <AppHeader account={<AccountMenu auth={auth} />} />
      </div>
    );
  }
  return (
    <>
      {auth.ready && (
        <>
          <TodoApp
            key={scope}
            storage={scope === "guest" ? localTodoStorage : accountTodoStorage}
            sync={sync}
            expired={status === "expired"}
            account={<AccountMenu auth={auth} />}
            banner={<AuthBanner auth={auth} />}
          />
          <MoveGuestTodosPrompt auth={auth} />
        </>
      )}
    </>
  );
}
