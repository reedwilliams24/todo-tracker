"use client";

import { useEffect, useState } from "react";
import { useTranslator } from "@todo/shared/react";

/** Browser-locale translator; English until hydrated so SSR and client match. */
export function useT() {
  const [languages, setLanguages] = useState<readonly string[]>([]);
  useEffect(() => {
    setLanguages(navigator.languages ?? [navigator.language]);
  }, []);
  return useTranslator(languages);
}
