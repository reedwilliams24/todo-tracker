import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import { planReminders, type Todo } from "@todo/shared";

type NotificationsModule = typeof import("expo-notifications");

const CHANNEL_ID = "due-reminders";

/**
 * expo-notifications throws at import time inside Expo Go on Android (push
 * support was removed from Expo Go in SDK 53), so it is loaded lazily and the
 * hook degrades to a no-op there and whenever the module is unavailable.
 */
function loadNotifications(): NotificationsModule | null {
  if (Platform.OS === "android" && isRunningInExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    return mod;
  } catch {
    return null;
  }
}

const Notifications = loadNotifications();

async function ensurePermission(Notifications: NotificationsModule): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Keeps OS-scheduled local notifications in sync with the shared reminder plan:
 * every change to the list cancels and reschedules the upcoming reminders.
 */
export function useReminders(todos: readonly Todo[]) {
  const granted = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!Notifications) return;
    if (!granted.current) {
      granted.current = (async () => {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: "Due reminders",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        return ensurePermission(Notifications);
      })();
    }
    let cancelled = false;

    void granted.current.then(async (ok) => {
      if (!ok || cancelled) return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      const now = Date.now();
      for (const reminder of planReminders(todos)) {
        if (reminder.at.getTime() <= now || cancelled) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.key,
          content: { title: reminder.title, body: reminder.body },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.at,
            channelId: CHANNEL_ID,
          },
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [todos]);
}
