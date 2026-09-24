import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEME_STORAGE_KEY, type ThemeStorage } from "@todo/shared";

export const asyncThemeStorage: ThemeStorage = {
  async load() {
    try {
      return await AsyncStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  async save(preference) {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // storage unavailable
    }
  },
};
