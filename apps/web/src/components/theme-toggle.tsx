"use client";

import { TEST_IDS, THEME_PREFERENCES, type ThemePreference } from "@/domain";
import { useT } from "@/hooks/use-t";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const t = useT();
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t("theme.label")}
      data-testid={TEST_IDS.themeToggle}
      className="flex rounded-lg border border-black/10 text-xs dark:border-white/15"
    >
      {THEME_PREFERENCES.map((option: ThemePreference) => {
        const selected = option === preference;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={TEST_IDS.themeOption(option)}
            onClick={() => setPreference(option)}
            className={`px-2.5 py-1 first:rounded-l-lg last:rounded-r-lg ${
              selected ? "bg-foreground text-background" : "opacity-70 hover:opacity-100"
            }`}
          >
            {t(`theme.${option}`)}
          </button>
        );
      })}
    </div>
  );
}
