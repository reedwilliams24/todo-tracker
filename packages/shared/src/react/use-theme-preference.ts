import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeStorage,
} from "../theme";

/**
 * Persisted light/dark/system preference resolved against the OS setting.
 * `storage` should be a stable reference; `systemDark` comes from the platform.
 */
export function useThemePreference(storage: ThemeStorage, systemDark: boolean) {
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(storage.load()).then((raw) => {
      if (cancelled) return;
      setPreferenceState(parseThemePreference(raw));
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      void storage.save(next);
    },
    [storage],
  );

  const theme: ResolvedTheme = resolveTheme(preference, systemDark);
  return { preference, theme, hydrated, setPreference };
}
