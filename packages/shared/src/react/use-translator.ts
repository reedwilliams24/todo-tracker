import { useMemo } from "react";
import { createTranslator, resolveLocale, type Translator } from "../i18n";

/** Translator for the first supported locale among `preferred` (English fallback). */
export function useTranslator(preferred: readonly (string | null | undefined)[]): Translator {
  const locale = resolveLocale(preferred);
  return useMemo(() => createTranslator(locale), [locale]);
}
