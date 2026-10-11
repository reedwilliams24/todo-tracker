import { THEME_STORAGE_KEY, type ThemeStorage } from "@/domain";

export const localThemeStorage: ThemeStorage = {
  load() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  save(preference) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // storage unavailable
    }
  },
};
