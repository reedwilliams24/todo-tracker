import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { todaySummary } from "@todo/shared";
import { asyncTodoStorage } from "../lib/storage";
import { TodayWidget } from "./today-widget";

export const TODAY_WIDGET_NAME = "Today";

/** Runs headless when Android asks the widget to (re)draw; reads the same AsyncStorage as the app. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === "WIDGET_DELETED") return;
  const todos = await asyncTodoStorage.load();
  props.renderWidget(<TodayWidget summary={todaySummary(todos)} />);
}
