import { createContext, useContext, useMemo } from "react";
import type { ResolvedTheme, ThemePreference, TodoPriority } from "@todo/shared";

export type ThemeColors = {
  background: string;
  card: string;
  border: string;
  foreground: string;
  muted: string;
  danger: string;
};

export const palettes: Record<ResolvedTheme, ThemeColors> = {
  light: {
    background: "#f7f7f5",
    card: "#ffffff",
    border: "rgba(0,0,0,0.1)",
    foreground: "#171717",
    muted: "rgba(23,23,23,0.6)",
    danger: "#dc2626",
  },
  dark: {
    background: "#0b0c0f",
    card: "#16181d",
    border: "rgba(255,255,255,0.15)",
    foreground: "#e9eaee",
    muted: "rgba(233,234,238,0.65)",
    danger: "#f87171",
  },
};

export const priorityColors: Record<
  ResolvedTheme,
  Record<TodoPriority, { bg: string; text: string }>
> = {
  light: {
    high: { bg: "rgba(239,68,68,0.15)", text: "#dc2626" },
    medium: { bg: "rgba(245,158,11,0.15)", text: "#d97706" },
    low: { bg: "rgba(16,185,129,0.15)", text: "#059669" },
  },
  dark: {
    high: { bg: "rgba(239,68,68,0.2)", text: "#f87171" },
    medium: { bg: "rgba(245,158,11,0.2)", text: "#fbbf24" },
    low: { bg: "rgba(16,185,129,0.2)", text: "#34d399" },
  },
};

export type ThemeContextValue = {
  theme: ResolvedTheme;
  preference: ThemePreference;
  colors: ThemeColors;
  setPreference: (preference: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  preference: "system",
  colors: palettes.light,
  setPreference: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Memoized StyleSheet built from the current palette. */
export function useStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
