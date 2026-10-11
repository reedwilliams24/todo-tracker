"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { INITIAL_AUTH_STATE, reduceAuth, resendSecondsLeft, type AuthEvent } from "@/domain";
import { claimAccount, readOwner, wipeAccount, wipeGuest, type GuestTodoMover } from "@/lib/account";
import { toAuthFailure, type AuthClient, type AuthSession } from "@/lib/auth-client";
import { localTodoStorage } from "@/lib/storage";

/** Sign-in UI state for `client` (null = guest-only build). Drives the pure reducer from spec/features/auth.md. */
export function useAuth(client: AuthClient | null, mover: GuestTodoMover) {
  const [state, dispatchState] = useReducer(reduceAuth, INITIAL_AUTH_STATE);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [moveFailed, setMoveFailed] = useState(false);

  const dispatch = useCallback((event: AuthEvent) => {
    stateRef.current = reduceAuth(stateRef.current, event);
    dispatchState(event);
    return stateRef.current;
  }, []);

  useEffect(() => {
    if (!client) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const unsubscribe = client.onChange(({ session: next, initiated }) => {
      setSession(next);
      if (!next) dispatch({ type: "signedOut", initiated });
    });
    void client
      .restore()
      .catch(() => null)
      .then((restored) => {
        if (cancelled) return;
        const owner = readOwner();
        if (restored) {
          claimAccount(restored);
          setSession(restored);
          dispatch({ type: "signedIn", userId: restored.userId, email: restored.email, guestCount: 0 });
        } else if (owner) {
          dispatch({ type: "signedIn", userId: owner.userId, email: owner.email, guestCount: 0 });
          dispatch({ type: "signedOut", initiated: false });
        }
        setReady(true);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, dispatch]);

  useEffect(() => {
    if (state.resendAt === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.resendAt]);

  const sendCode = useCallback(
    async (email: string) => {
      if (!client || stateRef.current.busy) return;
      const next = dispatch({ type: "sendCode", email });
      if (!next.busy) return;
      try {
        await client.sendCode(next.email);
        dispatch({ type: "codeSent", now: Date.now() });
      } catch (error) {
        dispatch({ type: "failed", error: toAuthFailure(error).kind });
      }
    },
    [client, dispatch],
  );

  const verify = useCallback(
    async (code: string) => {
      if (!client || stateRef.current.busy) return;
      const next = dispatch({ type: "verify", code });
      if (!next.busy) return;
      try {
        const signedIn = await client.verifyCode(next.email, code);
        const guest = await Promise.resolve(localTodoStorage.load());
        claimAccount(signedIn);
        setSession(signedIn);
        dispatch({ type: "signedIn", userId: signedIn.userId, email: signedIn.email, guestCount: guest.length });
      } catch (error) {
        dispatch({ type: "failed", error: toAuthFailure(error).kind });
      }
    },
    [client, dispatch],
  );

  const resolveGuestTodos = useCallback(
    async (move: boolean) => {
      setMoveFailed(false);
      if (move && session) {
        try {
          await mover.move(await Promise.resolve(localTodoStorage.load()), session);
        } catch {
          setMoveFailed(true);
          return;
        }
      }
      wipeGuest();
      dispatch({ type: "guestResolved" });
    },
    [dispatch, mover, session],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    try {
      await client.signOut();
    } finally {
      wipeAccount();
      wipeGuest();
      setSession(null);
      dispatch({ type: "signedOut", initiated: true });
    }
  }, [client, dispatch]);

  return {
    state,
    ready,
    session,
    moveFailed,
    resendSeconds: resendSecondsLeft(state, now),
    open: () => dispatch({ type: "open" }),
    cancel: () => dispatch({ type: "cancel" }),
    changeEmail: () => dispatch({ type: "changeEmail" }),
    sendCode,
    verify,
    resolveGuestTodos,
    signOut,
  };
}

export type Auth = ReturnType<typeof useAuth>;
