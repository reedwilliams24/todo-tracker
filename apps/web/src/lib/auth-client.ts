import { isAuthError, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { authErrorKind, type AuthError } from "@/domain";

/** What REED-68 (sync) and REED-72 (delete account) need from auth. */
export type AuthSession = { userId: string; email: string; accessToken: string };
/** `initiated` is false when the session ended without the user signing out (expired refresh token). */
export type AuthChange = { session: AuthSession | null; initiated: boolean };

export class AuthFailure extends Error {
  constructor(readonly kind: AuthError) {
    super(kind);
  }
}

export interface AuthClient {
  /** The persisted session, refreshed if it had expired; null when signed out. */
  restore(): Promise<AuthSession | null>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<AuthSession>;
  /** Closes Realtime and ends the session. */
  signOut(): Promise<void>;
  /** Deletes the user's todos and auth user on the server (`delete_account`), then ends the session like `signOut`. */
  deleteAccount(): Promise<void>;
  /** Sign-ins, token refreshes and sign-outs after `restore`. */
  onChange(listener: (change: AuthChange) => void): () => void;
}

export function toAuthFailure(error: unknown): AuthFailure {
  if (error instanceof AuthFailure) return error;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return new AuthFailure("offline");
  if (isAuthError(error)) return new AuthFailure(authErrorKind(error.status ?? null, error.code ?? null));
  return new AuthFailure(error instanceof TypeError ? "offline" : "unknown");
}

function toSession(session: Session): AuthSession {
  return { userId: session.user.id, email: session.user.email ?? "", accessToken: session.access_token };
}

/** Supabase Auth with supabase-js's default session storage (localStorage) and auto-refresh. */
export function createSupabaseAuthClient(client: SupabaseClient): AuthClient {
  let signingOut = false;
  return {
    async restore() {
      const { data } = await client.auth.getSession();
      return data.session ? toSession(data.session) : null;
    },
    async sendCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw toAuthFailure(error);
    },
    async verifyCode(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
      if (error || !data.session) throw toAuthFailure(error);
      return toSession(data.session);
    },
    async signOut() {
      signingOut = true;
      try {
        await client.removeAllChannels();
        const { error } = await client.auth.signOut();
        // Offline or already revoked: still end the session on this device.
        if (error) await client.auth.signOut({ scope: "local" });
      } finally {
        signingOut = false;
      }
    },
    async deleteAccount() {
      const { error } = await client.rpc("delete_account");
      if (error) throw toAuthFailure(error);
      signingOut = true;
      try {
        await client.removeAllChannels();
        // The server already revoked every session along with the user.
        await client.auth.signOut({ scope: "local" });
      } finally {
        signingOut = false;
      }
    },
    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION") return;
        if (event === "SIGNED_OUT") listener({ session: null, initiated: signingOut });
        else if (session) listener({ session: toSession(session), initiated: true });
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
