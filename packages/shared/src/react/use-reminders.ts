import { useEffect, useRef } from "react";
import { dueReminders, pruneDelivered, type Reminder } from "../reminders";
import type { MaybePromise } from "../storage";
import type { Todo } from "../types";

export type DeliveredStorage = {
  load(): MaybePromise<readonly string[] | null>;
  save(keys: readonly string[]): MaybePromise<void>;
};

export type ReminderNotifier = {
  /** Return false to skip marking the reminder delivered (e.g. no permission). */
  notify(reminder: Reminder): MaybePromise<boolean>;
};

export const REMINDER_POLL_MS = 30_000;

/**
 * Polls for reminders whose time has arrived and hands them to the platform
 * notifier once each, remembering delivered keys in `storage`.
 * `storage` and `notifier` should be stable references.
 */
export function useReminders(
  todos: readonly Todo[],
  storage: DeliveredStorage,
  notifier: ReminderNotifier,
  enabled = true,
) {
  const delivered = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function tick() {
      if (!delivered.current) {
        delivered.current = new Set((await storage.load()) ?? []);
        if (cancelled) return;
      }
      const due = dueReminders(todos, delivered.current);
      let changed = false;
      for (const reminder of due) {
        if (await notifier.notify(reminder)) {
          delivered.current.add(reminder.key);
          changed = true;
        }
      }
      const pruned = pruneDelivered(delivered.current, todos);
      if (changed || pruned.size !== delivered.current.size) {
        delivered.current = pruned;
        await storage.save([...pruned]);
      }
    }

    void tick();
    const timer = setInterval(() => void tick(), REMINDER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [todos, storage, notifier, enabled]);
}
