import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { TodaySummary } from "@todo/shared";

const palette = {
  background: "#16181d",
  foreground: "#e9eaee",
  muted: "#a3a6ad",
  danger: "#f87171",
} as const;

export function TodayWidget({ summary }: { summary: TodaySummary }) {
  const subtitle =
    summary.remaining === 0
      ? "All done"
      : [
          summary.overdue > 0 ? `${summary.overdue} overdue` : null,
          `${summary.dueToday} due today`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: palette.background,
        borderRadius: 16,
        padding: 14,
        flexDirection: "column",
        flexGap: 6,
      }}
    >
      <TextWidget text="Today" style={{ fontSize: 16, fontWeight: "600", color: palette.foreground }} />
      <TextWidget
        text={subtitle}
        style={{ fontSize: 12, color: summary.overdue > 0 ? palette.danger : palette.muted }}
      />
      {summary.todos.map((todo) => (
        <TextWidget
          key={todo.id}
          text={`○ ${todo.title}`}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, color: palette.foreground }}
        />
      ))}
      {summary.remaining > summary.todos.length && (
        <TextWidget
          text={`+${summary.remaining - summary.todos.length} more`}
          style={{ fontSize: 12, color: palette.muted }}
        />
      )}
    </FlexWidget>
  );
}
