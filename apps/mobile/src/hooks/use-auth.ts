import { useCallback, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AuthUser = { id: string; email?: string };

const REDIRECT = "todotracker://auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(supabase === null);

  useEffect(() => {
    if (!supabase) return;
    const apply = (session: Session | null) => {
      setUser(session ? { id: session.user.id, email: session.user.email } : null);
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  /** Sends a 6-digit code (works in Expo Go; no deep link needed). */
  const sendEmailCode = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  }, []);

  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
  }, []);

  const signInWithProvider = useCallback(async (provider: "google" | "apple") => {
    if (!supabase) return;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
    if (result.type !== "success") return;
    const code = new URL(result.url).searchParams.get("code");
    if (!code) return;
    const exchange = await supabase.auth.exchangeCodeForSession(code);
    if (exchange.error) throw exchange.error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return {
    enabled: supabase !== null,
    ready,
    user,
    sendEmailCode,
    verifyEmailCode,
    signInWithProvider,
    signOut,
  };
}
