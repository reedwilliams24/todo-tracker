"use client";

import { useCallback, useEffect, useState } from "react";
import { useReminders as useSharedReminders } from "@todo/shared/react";
import type { Todo } from "@todo/shared";
import { browserNotifier, localDeliveredStorage, notificationsSupported } from "@/lib/reminders";

export type ReminderPermission = NotificationPermission | "unsupported";

export function useReminders(todos: readonly Todo[]) {
  const [permission, setPermission] = useState<ReminderPermission>("default");

  useEffect(() => {
    setPermission(notificationsSupported() ? Notification.permission : "unsupported");
  }, []);

  const request = useCallback(async () => {
    if (!notificationsSupported()) return;
    setPermission(await Notification.requestPermission());
  }, []);

  useSharedReminders(todos, localDeliveredStorage, browserNotifier, permission === "granted");

  return { permission, request };
}
