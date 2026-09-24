import { getLocales } from "expo-localization";
import { useTranslator } from "@todo/shared/react";

export function useT() {
  return useTranslator(getLocales().map((locale) => locale.languageTag));
}
