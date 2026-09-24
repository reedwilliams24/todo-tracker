"use client";

import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from "@todo/shared";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
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
            onClick={() => setPreference(option)}
            className={`px-2.5 py-1 first:rounded-l-lg last:rounded-r-lg ${
              selected ? "bg-foreground text-background" : "opacity-70 hover:opacity-100"
            }`}
          >
            {THEME_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
