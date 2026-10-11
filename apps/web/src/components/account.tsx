"use client";

import { useState } from "react";
import { AUTH_CODE_LENGTH, isValidCode, normalizeCode, TEST_IDS } from "@/domain";
import { useT } from "@/hooks/use-t";
import type { Auth } from "@/hooks/use-auth";

const BUTTON =
  "rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-white/15";
const PRIMARY = "rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50";
const INPUT =
  "w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none placeholder:opacity-50 dark:border-white/15";
const CARD =
  "flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/15 dark:bg-white/5";

export function AuthBanner({ auth }: { auth: Auth }) {
  const t = useT();
  const { status, step } = auth.state;
  if (status === "signedIn") return null;
  const expired = status === "expired";
  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        data-testid={expired ? TEST_IDS.authExpiredBanner : TEST_IDS.authGuestBanner}
        className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm"
      >
        <span>{t(expired ? "auth.expired.banner" : "auth.guest.banner")}</span>
        {step === null && (
          <button type="button" data-testid={TEST_IDS.authSignIn} className={PRIMARY} onClick={auth.open}>
            {t(expired ? "auth.expired.signIn" : "auth.signIn")}
          </button>
        )}
      </div>
      {step !== null && <SignInForm auth={auth} />}
    </div>
  );
}

function SignInForm({ auth }: { auth: Auth }) {
  const t = useT();
  const { step, busy, error, email: sentTo } = auth.state;
  const [email, setEmail] = useState(sentTo);
  const [code, setCode] = useState("");
  return (
    <form
      data-testid={TEST_IDS.authSheet}
      aria-label={t("auth.title")}
      className={CARD}
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "email") void auth.sendCode(email);
        else void auth.verify(code);
      }}
    >
      <h2 className="font-semibold">{t("auth.title")}</h2>
      {step === "email" ? (
        <label className="flex flex-col gap-1 text-sm">
          {t("auth.email.label")}
          <input
            data-testid={TEST_IDS.authEmail}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            className={INPUT}
            placeholder={t("auth.email.placeholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      ) : (
        <>
          <p className="text-sm opacity-80">{t("auth.codeSent", { email: sentTo })}</p>
          <label className="flex flex-col gap-1 text-sm">
            {t("auth.code.label")}
            <input
              data-testid={TEST_IDS.authCode}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={AUTH_CODE_LENGTH + 2}
              autoFocus
              className={`${INPUT} font-mono tracking-[0.4em]`}
              value={code}
              onChange={(event) => setCode(normalizeCode(event.target.value))}
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" data-testid={TEST_IDS.authError} className="text-sm text-red-600 dark:text-red-400">
          {t(`auth.error.${error}`)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {step === "email" ? (
          <button type="submit" data-testid={TEST_IDS.authSendCode} className={PRIMARY} disabled={busy}>
            {t(busy ? "auth.sending" : "auth.sendCode")}
          </button>
        ) : (
          <>
            <button
              type="submit"
              data-testid={TEST_IDS.authVerify}
              className={PRIMARY}
              disabled={busy || !isValidCode(code)}
            >
              {t(busy ? "auth.verifying" : "auth.verify")}
            </button>
            <button
              type="button"
              data-testid={TEST_IDS.authResend}
              className={BUTTON}
              disabled={busy || auth.resendSeconds > 0}
              onClick={() => void auth.sendCode(sentTo)}
            >
              {auth.resendSeconds > 0 ? t("auth.resendIn", { seconds: auth.resendSeconds }) : t("auth.resend")}
            </button>
            <button type="button" data-testid={TEST_IDS.authChangeEmail} className={BUTTON} onClick={auth.changeEmail}>
              {t("auth.changeEmail")}
            </button>
          </>
        )}
        <button type="button" data-testid={TEST_IDS.authCancel} className={BUTTON} onClick={auth.cancel}>
          {t("auth.cancel")}
        </button>
      </div>
    </form>
  );
}

export function MoveGuestTodosPrompt({ auth }: { auth: Auth }) {
  const t = useT();
  const count = auth.state.movePrompt;
  const [busy, setBusy] = useState(false);
  if (count === null) return null;
  const resolve = (move: boolean) => {
    setBusy(true);
    void auth.resolveGuestTodos(move).finally(() => setBusy(false));
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        data-testid={TEST_IDS.authMovePrompt}
        className={`${CARD} max-w-sm bg-background`}
      >
        <p className="font-medium">{t("auth.move.prompt", { count })}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-testid={TEST_IDS.authMoveDiscard}
            className={BUTTON}
            disabled={busy}
            onClick={() => resolve(false)}
          >
            {t("auth.move.discard")}
          </button>
          <button
            type="button"
            data-testid={TEST_IDS.authMoveConfirm}
            className={PRIMARY}
            disabled={busy}
            onClick={() => resolve(true)}
          >
            {t("auth.move.move")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountMenu({ auth }: { auth: Auth }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { status, email } = auth.state;
  if (status === "signedOut") return null;
  return (
    <div className="relative">
      <button
        type="button"
        data-testid={TEST_IDS.authAccount}
        aria-label={t("auth.account.label")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="max-w-48 truncate rounded-lg border border-black/10 px-2.5 py-1 text-xs dark:border-white/15"
        onClick={() => setOpen((value) => !value)}
      >
        {email}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 flex w-60 flex-col gap-2 rounded-xl border border-black/10 bg-background p-3 text-sm shadow-lg dark:border-white/15"
        >
          <span data-testid={TEST_IDS.authAccountEmail} className="truncate opacity-80">
            {t("auth.account.signedInAs", { email })}
          </span>
          <button
            type="button"
            role="menuitem"
            data-testid={TEST_IDS.authSignOut}
            className={BUTTON}
            onClick={() => {
              setOpen(false);
              void auth.signOut();
            }}
          >
            {t("auth.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
