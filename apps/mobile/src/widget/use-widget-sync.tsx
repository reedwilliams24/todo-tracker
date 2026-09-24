import { useEffect } from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { todaySummary, type Todo } from "@todo/shared";
import { TodayWidget } from "./today-widget";
import { TODAY_WIDGET_NAME } from "./widget-task-handler";

/** Redraws the home-screen widget whenever the list changes (Android only). */
export function useWidgetSync(todos: readonly Todo[], hydrated: boolean) {
  useEffect(() => {
    if (!hydrated || Platform.OS !== "android") return;
    void requestWidgetUpdate({
      widgetName: TODAY_WIDGET_NAME,
      renderWidget: () => <TodayWidget summary={todaySummary(todos)} />,
    }).catch(() => {
      // widget module unavailable (Expo Go) - ignore
    });
  }, [todos, hydrated]);
}
