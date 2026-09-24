"use client";

import { useT } from "@/hooks/use-t";

export function AppHeader() {
  const t = useT();
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-3xl font-semibold tracking-tight">{t("app.title")}</h1>
      <p className="text-sm opacity-70">{t("app.tagline.web")}</p>
    </header>
  );
}
