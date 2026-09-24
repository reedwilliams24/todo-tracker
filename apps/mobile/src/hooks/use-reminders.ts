import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { planReminders, type Todo } from "@todo/shared";

const CHANNEL_ID = "due-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
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
    if (!granted.current) {
      granted.current = (async () => {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: "Due reminders",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        return ensurePermission();
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
