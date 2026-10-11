import { ACCOUNT_STORAGE_KEY, guestToRows, STORAGE_KEY, type Todo } from "@/domain";
import type { AuthSession } from "@/lib/auth-client";
import type { CursorStore, SyncServer } from "@/lib/sync-engine";

/** Who the account cache belongs to; kept after an expired session so signing back in loses nothing. */
export const ACCOUNT_OWNER_KEY = `${ACCOUNT_STORAGE_KEY}:owner`;
/** The pull cursor; sign out wipes it with the cache. */
export const SYNC_CURSOR_KEY = "todo-tracker:sync-cursor:v1";

export type AccountOwner = { userId: string; email: string };

/** Move on the first-sign-in prompt. Throws if the todos couldn't be moved. */
export interface GuestTodoMover {
  move(guest: readonly Todo[], session: AuthSession): Promise<void>;
}

/** Pushes the guest todos as new account rows (`guestToRows` + `push_todos`); the account list pulls them in. */
export function serverGuestTodoMover(server: SyncServer): GuestTodoMover {
  return {
    async move(guest, session) {
      const rows = guestToRows(guest, session.userId, new Date());
      if (rows.length > 0) await server.push(rows);
    },
  };
}

export const syncCursorStorage: CursorStore = {
  load() {
    try {
      const value = Number(window.localStorage.getItem(SYNC_CURSOR_KEY));
      return Number.isSafeInteger(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  },
  save(cursor) {
    try {
      window.localStorage.setItem(SYNC_CURSOR_KEY, String(cursor));
    } catch {}
  },
};

function remove(...keys: string[]) {
  try {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {}
}

export function readOwner(): AccountOwner | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_OWNER_KEY);
    const owner = raw ? (JSON.parse(raw) as Partial<AccountOwner>) : null;
    return owner?.userId ? { userId: owner.userId, email: owner.email ?? "" } : null;
  } catch {
    return null;
  }
}

/** Makes the cache `session`'s; a different user's cache is wiped first. */
export function claimAccount(session: AuthSession) {
  if (readOwner()?.userId !== session.userId) wipeAccount();
  try {
    window.localStorage.setItem(ACCOUNT_OWNER_KEY, JSON.stringify({ userId: session.userId, email: session.email }));
  } catch {}
}

export function wipeAccount() {
  remove(ACCOUNT_STORAGE_KEY, ACCOUNT_OWNER_KEY, SYNC_CURSOR_KEY);
}

export function wipeGuest() {
  remove(STORAGE_KEY);
}
