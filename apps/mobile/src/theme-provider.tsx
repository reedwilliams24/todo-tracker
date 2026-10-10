import { useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useThemePreference } from "@todo/shared/react";
import { asyncThemeStorage } from "./lib/theme-storage";
import { ThemeContext, palettes } from "./theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemDark = useColorScheme() === "dark";
  const { preference, theme, setPreference } = useThemePreference(asyncThemeStorage, systemDark);
  const value = useMemo(
    () => ({ theme, preference, colors: palettes[theme], setPreference }),
    [theme, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
