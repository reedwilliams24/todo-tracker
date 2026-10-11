"use client";

import { useMemo } from "react";
import { AccountMenu, AuthBanner, MoveGuestTodosPrompt } from "@/components/account";
import { AppHeader } from "@/components/app-header";
import { TodoApp } from "@/components/todo-app";
import { useAuth } from "@/hooks/use-auth";
import { localGuestTodoMover } from "@/lib/account";
import { createSupabaseAuthClient } from "@/lib/auth-client";
import { accountTodoStorage, localTodoStorage } from "@/lib/storage";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/** Header + list. Without Supabase config this is exactly the guest-only app. */
export function AccountShell() {
  if (!supabaseConfigured) {
    return (
      <>
        <AppHeader />
        <TodoApp />
      </>
    );
  }
  return <SignedInShell />;
}

function SignedInShell() {
  const client = useMemo(() => {
    const supabase = getSupabase();
    return supabase ? createSupabaseAuthClient(supabase) : null;
  }, []);
  const auth = useAuth(client, localGuestTodoMover);
  const { status, userId, movePrompt } = auth.state;
  const scope = status === "signedOut" || movePrompt !== null ? "guest" : `account:${userId}`;
  return (
    <>
      <AppHeader account={<AccountMenu auth={auth} />} />
      {auth.ready && (
        <>
          <AuthBanner auth={auth} />
          <TodoApp key={scope} storage={scope === "guest" ? localTodoStorage : accountTodoStorage} />
          <MoveGuestTodosPrompt auth={auth} />
        </>
      )}
    </>
  );
}
