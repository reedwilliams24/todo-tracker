"use client";

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useT } from "@/hooks/use-t";

export function AppHeader({ account }: { account?: ReactNode }) {
  const t = useT();
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("app.title")}</h1>
        <p className="text-sm opacity-70">{t("app.tagline.web")}</p>
      </div>
      <div className="flex items-center gap-2">
        {account}
        <ThemeToggle />
      </div>
    </header>
  );
}
