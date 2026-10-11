/** Email-code sign-in state (spec/features/auth.md). Pure: the platform's AuthClient feeds it events. */

export const AUTH_CODE_LENGTH = 6;
export const AUTH_RESEND_MS = 60_000;
/** The signed-in account's local cache; the guest list keeps STORAGE_KEY. */
export const ACCOUNT_STORAGE_KEY = "todo-tracker:account:v1";

export type AuthError = "invalidEmail" | "wrongCode" | "rateLimited" | "offline" | "unknown";
export type AuthStatus = "signedOut" | "signedIn" | "expired";
export type AuthStep = "email" | "code";

export type AuthState = {
  status: AuthStatus;
  /** The open sign-in form's step; null when it is closed. */
  step: AuthStep | null;
  email: string;
  userId: string | null;
  busy: boolean;
  error: AuthError | null;
  /** Epoch ms after which a new code may be requested. */
  resendAt: number | null;
  /** Guest todo count waiting on the Move/Discard prompt. */
  movePrompt: number | null;
};

export type AuthEvent =
  | { type: "open" }
  | { type: "cancel" }
  | { type: "sendCode"; email: string }
  | { type: "codeSent"; now: number }
  | { type: "verify"; code: string }
  | { type: "failed"; error: AuthError }
  | { type: "changeEmail" }
  | { type: "signedIn"; userId: string; email: string; guestCount: number }
  | { type: "guestResolved" }
  | { type: "signedOut"; initiated: boolean };

export const INITIAL_AUTH_STATE: AuthState = {
  status: "signedOut",
  step: null,
  email: "",
  userId: null,
  busy: false,
  error: null,
  resendAt: null,
  movePrompt: null,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL.test(normalizeEmail(email));
}

/** Keeps the digits of typed or pasted input ("123 456" → "123456"), at most AUTH_CODE_LENGTH. */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, AUTH_CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^\\d{${AUTH_CODE_LENGTH}}$`).test(code);
}

/** Whole seconds until Resend is allowed; 0 when it is. */
export function resendSecondsLeft(state: AuthState, now: number): number {
  if (state.resendAt === null) return 0;
  return Math.max(0, Math.ceil((state.resendAt - now) / 1000));
}

const RATE_LIMIT_CODES = ["over_email_send_rate_limit", "over_request_rate_limit"];
const WRONG_CODE_CODES = ["otp_expired", "invalid_credentials", "otp_disabled"];
const INVALID_EMAIL_CODES = ["email_address_invalid", "validation_failed"];

/** Maps an auth API failure (HTTP status, Supabase `error_code`) to the error shown. No status = no response = offline. */
export function authErrorKind(status: number | null, code: string | null): AuthError {
  if (status === null || status === 0) return "offline";
  if (status === 429 || (code !== null && RATE_LIMIT_CODES.includes(code))) return "rateLimited";
  if (code !== null && WRONG_CODE_CODES.includes(code)) return "wrongCode";
  if (code !== null && INVALID_EMAIL_CODES.includes(code)) return "invalidEmail";
  if (status === 403) return "wrongCode";
  return "unknown";
}

export function reduceAuth(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case "open":
      return { ...state, step: "email", busy: false, error: null };
    case "cancel":
      return { ...state, step: null, busy: false, error: null };
    case "sendCode": {
      if (state.busy) return state;
      const email = normalizeEmail(event.email);
      if (!isValidEmail(email)) return { ...state, email, error: "invalidEmail" };
      return { ...state, email, busy: true, error: null };
    }
    case "codeSent":
      return { ...state, step: "code", busy: false, error: null, resendAt: event.now + AUTH_RESEND_MS };
    case "verify":
      if (state.busy || !isValidCode(event.code)) return state;
      return { ...state, busy: true, error: null };
    case "failed":
      return { ...state, busy: false, error: event.error };
    case "changeEmail":
      return { ...state, step: "email", busy: false, error: null };
    case "signedIn":
      return {
        ...INITIAL_AUTH_STATE,
        status: "signedIn",
        email: normalizeEmail(event.email),
        userId: event.userId,
        movePrompt: event.guestCount > 0 ? event.guestCount : null,
      };
    case "guestResolved":
      return { ...state, movePrompt: null };
    case "signedOut":
      if (event.initiated || state.status === "signedOut") return INITIAL_AUTH_STATE;
      return { ...INITIAL_AUTH_STATE, status: "expired", email: state.email, userId: state.userId };
  }
}
