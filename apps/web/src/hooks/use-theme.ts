"use client";

import { useEffect, useState } from "react";
import { useThemePreference } from "@todo/shared/react";
import { localThemeStorage } from "@/lib/theme-storage";

const QUERY = "(prefers-color-scheme: dark)";

function useSystemDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    setDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return dark;
}

export function useTheme() {
  const systemDark = useSystemDark();
  const result = useThemePreference(localThemeStorage, systemDark);

  useEffect(() => {
    if (!result.hydrated) return;
    document.documentElement.classList.toggle("dark", result.theme === "dark");
  }, [result.hydrated, result.theme]);

  return result;
}
