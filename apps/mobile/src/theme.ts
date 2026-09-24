import type { TodoPriority } from "@todo/shared";

export const colors = {
  background: "#f7f7f5",
  card: "#ffffff",
  border: "rgba(0,0,0,0.1)",
  foreground: "#171717",
  muted: "rgba(23,23,23,0.7)",
};

export const priorityColors: Record<TodoPriority, { bg: string; text: string }> = {
  high: { bg: "rgba(239,68,68,0.15)", text: "#dc2626" },
  medium: { bg: "rgba(245,158,11,0.15)", text: "#d97706" },
  low: { bg: "rgba(16,185,129,0.15)", text: "#059669" },
};
