import { ACCOUNT_STORAGE_KEY, STORAGE_KEY, type Todo } from "@/domain";
import type { AuthSession } from "@/lib/auth-client";
import { accountTodoStorage } from "@/lib/storage";

/** Who the account cache belongs to; kept after an expired session so signing back in loses nothing. */
export const ACCOUNT_OWNER_KEY = `${ACCOUNT_STORAGE_KEY}:owner`;
/** The pull cursor REED-68 stores; sign out wipes it with the cache. */
export const SYNC_CURSOR_KEY = "todo-tracker:sync-cursor:v1";

export type AccountOwner = { userId: string; email: string };

/** Move on the first-sign-in prompt. REED-68 implements it with `guestToRows` + `push_todos`. */
export interface GuestTodoMover {
  move(guest: readonly Todo[], session: AuthSession): Promise<void>;
}

/** Until sync lands: the guest todos become the account's local list on this device. */
export const localGuestTodoMover: GuestTodoMover = {
  async move(guest) {
    const existing = await Promise.resolve(accountTodoStorage.load());
    const ids = new Set(existing.map((todo) => todo.id));
    await accountTodoStorage.save([...guest.filter((todo) => !ids.has(todo.id)), ...existing]);
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
