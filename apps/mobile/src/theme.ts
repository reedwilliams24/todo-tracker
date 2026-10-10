import type { TodoPriority } from "@todo/shared";

export const colors = {
  background: "#f7f7f5",
  card: "#ffffff",
  border: "rgba(0,0,0,0.1)",
  foreground: "#171717",
  muted: "rgba(23,23,23,0.6)",
  danger: "#dc2626",
};

export const priorityColors: Record<TodoPriority, { bg: string; text: string }> = {
  high: { bg: "rgba(239,68,68,0.15)", text: "#dc2626" },
  medium: { bg: "rgba(245,158,11,0.15)", text: "#d97706" },
  low: { bg: "rgba(16,185,129,0.15)", text: "#059669" },
};

// Tailwind scale used by apps/web (1 unit = 4px)
export const spacing = {
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  10: 40,
} as const;

export const radius = {
  sm: 4, // rounded
  md: 8, // rounded-lg
  lg: 12, // rounded-xl
  full: 999, // rounded-full
} as const;

export const fontSize = {
  xs: 12, // text-xs
  sm: 14, // text-sm
  base: 16, // text-base
  lg: 18, // text-lg
  "2xl": 24, // text-2xl
} as const;

export const lineHeight = {
  xs: 14,
} as const;

export const borderWidth = {
  thin: 1,
  thick: 1.5,
} as const;

export const fontWeight = {
  medium: "500",
  semibold: "600",
} as const;
