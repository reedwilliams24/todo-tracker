"use client";

import { useState } from "react";
import { syncStatus, TEST_IDS } from "@/domain";
import type { useAuth } from "@/hooks/use-auth";

type Props = ReturnType<typeof useAuth> & { pending?: number };

export function AuthPanel({ enabled, ready, user, signInWithEmail, signInWithProvider, signOut, pending = 0 }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  if (!enabled || !ready) return null;

  if (user) {
    return (
      <div
        data-testid={TEST_IDS.authPanel}
        className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5">
        <span data-testid={TEST_IDS.authUser} className="truncate opacity-80">Signed in as {user.email ?? user.id} · {syncStatus(pending)}</span>
        <button type="button" data-testid={TEST_IDS.authSignOut} onClick={() => void signOut()} className="underline opacity-70 hover:opacity-100">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form
      data-testid={TEST_IDS.authPanel}
      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-3 text-sm dark:border-white/15 dark:bg-white/5"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus(null);
        signInWithEmail(email.trim())
          .then(() => setStatus("Check your email for a sign-in link."))
          .catch((error: Error) => setStatus(error.message));
      }}
    >
      <p className="opacity-70">Sign in to sync your todos across devices. Your local list comes with you.</p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          data-testid={TEST_IDS.authEmail}
          className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 outline-none focus:border-black/30 dark:border-white/15 dark:bg-black/20 dark:focus:border-white/40"
        />
        <button type="submit" data-testid={TEST_IDS.authSendCode} className="rounded-lg bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black">
          Email me a link
        </button>
      </div>
      <div className="flex gap-2">
        <button type="button" data-testid={TEST_IDS.authGoogle} onClick={() => void signInWithProvider("google")} className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/15">
          Continue with Google
        </button>
        <button type="button" data-testid={TEST_IDS.authApple} onClick={() => void signInWithProvider("apple")} className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/15">
          Continue with Apple
        </button>
      </div>
      {status && <p role="status" data-testid={TEST_IDS.authStatus} className="opacity-70">{status}</p>}
    </form>
  );
}
