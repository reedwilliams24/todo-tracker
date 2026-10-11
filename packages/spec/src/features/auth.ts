import {
  ACCOUNT_STORAGE_KEY,
  AUTH_CODE_LENGTH,
  AUTH_RESEND_MS,
  authErrorKind,
  INITIAL_AUTH_STATE,
  isValidCode,
  isValidEmail,
  normalizeCode,
  reduceAuth,
  resendSecondsLeft,
  type AuthEvent,
} from "web/domain";
import type { Case, Feature, Ops } from "../types";

const NOW = 1_767_225_600_000;
const SIGN_IN = { type: "signedIn", userId: "u1", email: "Reed@Example.com", guestCount: 0 };

function run(events: AuthEvent[]) {
  return events.reduce(reduceAuth, INITIAL_AUTH_STATE);
}

function flow(name: string, events: object[]): Case {
  return { name: `reduceAuth: ${name}`, op: "reduceAuth", given: { events } };
}

function cases(): Case[] {
  return [
    { name: "constants", op: "authConstants", given: {} },
    ...[
      "reed@example.com",
      "  Reed@Example.COM ",
      "a@b.co",
      "",
      "reed",
      "reed@example",
      "re ed@example.com",
      "@x.io",
      "a@@b.co",
    ].map((email) => ({ name: `isValidEmail ${JSON.stringify(email)}`, op: "isValidEmail", given: { email } })),
    ...["123456", "123 456", "12-34-56", "1234567", "12ab", ""].map((input) => ({
      name: `normalizeCode ${JSON.stringify(input)}`,
      op: "normalizeCode",
      given: { input },
    })),
    ...["123456", "12345", "1234567", "12345a", ""].map((code) => ({
      name: `isValidCode ${JSON.stringify(code)}`,
      op: "isValidCode",
      given: { code },
    })),
    ...[
      [null, null],
      [0, null],
      [429, "over_email_send_rate_limit"],
      [400, "over_request_rate_limit"],
      [403, "otp_expired"],
      [400, "invalid_credentials"],
      [403, null],
      [400, "email_address_invalid"],
      [422, "validation_failed"],
      [500, "unexpected_failure"],
      [400, null],
    ].map(([status, code]) => ({
      name: `authErrorKind ${status} ${code}`,
      op: "authErrorKind",
      given: { status, code },
    })),
    ...[0, 1, 59_001, 60_000, 61_000].map((elapsed) => ({
      name: `resendSecondsLeft after ${elapsed}ms`,
      op: "resendSecondsLeft",
      given: {
        events: [{ type: "open" }, { type: "sendCode", email: "a@b.co" }, { type: "codeSent", now: NOW }],
        now: NOW + elapsed,
      },
    })),
    { name: "resendSecondsLeft before any code", op: "resendSecondsLeft", given: { events: [], now: NOW } },
    flow("open", [{ type: "open" }]),
    flow("send code normalizes email", [{ type: "open" }, { type: "sendCode", email: " Reed@Example.com " }]),
    flow("send code rejects invalid email", [{ type: "open" }, { type: "sendCode", email: "reed" }]),
    flow("send code ignored while busy", [
      { type: "open" },
      { type: "sendCode", email: "a@b.co" },
      { type: "sendCode", email: "c@d.co" },
    ]),
    flow("code sent", [{ type: "open" }, { type: "sendCode", email: "a@b.co" }, { type: "codeSent", now: NOW }]),
    flow("send fails offline", [
      { type: "open" },
      { type: "sendCode", email: "a@b.co" },
      { type: "failed", error: "offline" },
    ]),
    flow("verify needs six digits", [
      { type: "open" },
      { type: "sendCode", email: "a@b.co" },
      { type: "codeSent", now: NOW },
      { type: "verify", code: "12345" },
    ]),
    flow("verify", [
      { type: "open" },
      { type: "sendCode", email: "a@b.co" },
      { type: "codeSent", now: NOW },
      { type: "verify", code: "123456" },
    ]),
    flow("wrong code", [
      { type: "open" },
      { type: "sendCode", email: "a@b.co" },
      { type: "codeSent", now: NOW },
      { type: "verify", code: "123456" },
      { type: "failed", error: "wrongCode" },
    ]),
    flow("resend rate limited keeps code step", [
      { type: "open" },
      { type: "sendCode", email: "a@b.co" },
      { type: "codeSent", now: NOW },
      { type: "sendCode", email: "a@b.co" },
      { type: "failed", error: "rateLimited" },
    ]),
    flow("change email", [
      { type: "open" },
      { type: "sendCode", email: "a@b.co" },
      { type: "codeSent", now: NOW },
      { type: "changeEmail" },
    ]),
    flow("cancel", [{ type: "open" }, { type: "sendCode", email: "reed" }, { type: "cancel" }]),
    flow("signed in without guest todos", [{ type: "open" }, SIGN_IN]),
    flow("signed in with guest todos prompts", [{ ...SIGN_IN, guestCount: 3 }]),
    flow("guest prompt resolved", [{ ...SIGN_IN, guestCount: 3 }, { type: "guestResolved" }]),
    flow("sign out", [SIGN_IN, { type: "signedOut", initiated: true }]),
    flow("session expired", [SIGN_IN, { type: "signedOut", initiated: false }]),
    flow("expired then sign in again", [
      SIGN_IN,
      { type: "signedOut", initiated: false },
      { type: "open" },
      { ...SIGN_IN, guestCount: 0 },
    ]),
    flow("signed out while signed out", [{ type: "signedOut", initiated: false }]),
  ];
}

export const feature: Feature = {
  feature: "auth",
  spec: "features/auth.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: cases(),
};

export const ops: Ops = {
  authConstants: () => ({
    accountStorageKey: ACCOUNT_STORAGE_KEY,
    codeLength: AUTH_CODE_LENGTH,
    resendMs: AUTH_RESEND_MS,
  }),
  authErrorKind: (g) => authErrorKind(g.status as number | null, g.code as string | null),
  isValidCode: (g) => isValidCode(g.code),
  isValidEmail: (g) => isValidEmail(g.email),
  normalizeCode: (g) => normalizeCode(g.input),
  reduceAuth: (g) => run(g.events as AuthEvent[]),
  resendSecondsLeft: (g) => resendSecondsLeft(run(g.events as AuthEvent[]), g.now as number),
};
