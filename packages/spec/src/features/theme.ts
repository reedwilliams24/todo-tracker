import {
  DEFAULT_THEME,
  nextThemePreference,
  parseThemePreference,
  resolveTheme,
  THEME_LABELS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "web/domain";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "theme",
  spec: "features/theme.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "themeConstants", given: {} },
    ...[
      ["light", "light"],
      ["dark", "dark"],
      ["system", "system"],
      ["null", null],
      ["empty", ""],
      ["unknown", "sepia"],
      ["wrong case", "Dark"],
    ].map(([label, raw]) => ({ name: `parseThemePreference ${label}`, op: "parseThemePreference", given: { raw } })),
    ...(["light", "dark", "system"] as const).flatMap((preference) =>
      [true, false].map((systemDark) => ({
        name: `resolveTheme ${preference} with ${systemDark ? "dark" : "light"} OS`,
        op: "resolveTheme",
        given: { preference, systemDark },
      })),
    ),
    ...(["light", "dark", "system"] as const).map((preference) => ({
      name: `nextThemePreference after ${preference}`,
      op: "nextThemePreference",
      given: { preference },
    })),
  ],
};

export const ops: Ops = {
  themeConstants: () => ({
    storageKey: THEME_STORAGE_KEY,
    defaultTheme: DEFAULT_THEME,
    preferences: THEME_PREFERENCES,
    labels: THEME_LABELS,
  }),
  parseThemePreference: (g) => parseThemePreference(g.raw),
  resolveTheme: (g) => resolveTheme(g.preference as ThemePreference, g.systemDark),
  nextThemePreference: (g) => nextThemePreference(g.preference as ThemePreference),
};
