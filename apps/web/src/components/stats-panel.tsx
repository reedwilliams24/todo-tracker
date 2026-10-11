"use client";

import { useMemo, useState } from "react";
import { computeStats, TEST_IDS, type Todo } from "@/domain";
import { useT } from "@/hooks/use-t";

export function StatsPanel({ todos }: { todos: readonly Todo[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => (open ? computeStats(todos) : undefined), [open, todos]);
  const max = stats ? Math.max(1, ...stats.perDay.map((d) => d.count)) : 1;

  return (
    <section className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/15 dark:bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="stats-panel"
        data-testid={TEST_IDS.statsToggle}
        className="flex w-full items-center justify-between text-sm"
      >
        <span className="font-medium">{t("stats.title")}</span>
        <span className="opacity-60">{t(open ? "stats.hide" : "stats.show")}</span>
      </button>
      {stats && (
        <div id="stats-panel" className="mt-3 flex flex-col gap-3">
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <dt className="text-xs opacity-60">{t("stats.completed")}</dt>
              <dd className="text-lg font-semibold" data-testid={TEST_IDS.statsTotal}>
                {stats.totalCompleted}
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">{t("stats.currentStreak")}</dt>
              <dd className="text-lg font-semibold" data-testid={TEST_IDS.statsCurrent}>
                {t("stats.days", { count: stats.currentStreak })}
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">{t("stats.longestStreak")}</dt>
              <dd className="text-lg font-semibold" data-testid={TEST_IDS.statsLongest}>
                {t("stats.days", { count: stats.longestStreak })}
              </dd>
            </div>
          </dl>
          <ol
            className="flex h-16 items-end gap-px"
            aria-label={t("stats.chart", { days: stats.perDay.length })}
            data-testid={TEST_IDS.statsChart}
          >
            {stats.perDay.map((day) => (
              <li
                key={day.date}
                title={`${day.date}: ${day.count}`}
                aria-label={t("stats.day", { date: day.date, count: day.count })}
                className="flex-1 rounded-t-sm bg-foreground/70"
                style={{ height: `${Math.max(day.count > 0 ? 8 : 2, (day.count / max) * 100)}%` }}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
