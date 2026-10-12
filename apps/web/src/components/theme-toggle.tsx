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
      className="flex rounded-lg border border-line bg-surface text-xs"
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
              selected ? "bg-soft font-semibold text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {t(`theme.${option}`)}
          </button>
        );
      })}
    </div>
  );
}
