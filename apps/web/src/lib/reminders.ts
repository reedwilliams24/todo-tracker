import type { DeliveredStorage, ReminderNotifier } from "@todo/shared/react";

export const DELIVERED_KEY = "todo-tracker:reminders-delivered";

export const localDeliveredStorage: DeliveredStorage = {
  load() {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(DELIVERED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
    } catch {
      return [];
    }
  },
  save(keys) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DELIVERED_KEY, JSON.stringify(keys));
    } catch {
      // storage unavailable
    }
  },
};

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export const browserNotifier: ReminderNotifier = {
  notify(reminder) {
    if (!notificationsSupported() || Notification.permission !== "granted") return false;
    new Notification(reminder.title, { body: reminder.body, tag: reminder.key });
    return true;
  },
};
