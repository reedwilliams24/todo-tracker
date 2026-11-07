"use client";

import { useMemo } from "react";
import { computeStats, TEST_IDS, type Todo } from "@/domain";
import { useT } from "@/hooks/use-t";

export function StatsPanel({ todos }: { todos: readonly Todo[] }) {
  const t = useT();
  const stats = useMemo(() => computeStats(todos), [todos]);
  const max = stats ? Math.max(1, ...stats.perDay.map((d) => d.count)) : 1;

  return (
    <section aria-label={t("stats.title")} className="rounded-[14px] border border-line bg-surface p-4">
      {stats && (
        <div id="stats-panel" className="flex flex-col gap-4">
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <dt className="text-xs text-muted">{t("stats.completed")}</dt>
              <dd className="text-2xl font-bold" data-testid={TEST_IDS.statsTotal}>
                {stats.totalCompleted}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("stats.currentStreak")}</dt>
              <dd className="text-2xl font-bold" data-testid={TEST_IDS.statsCurrent}>
                {t("stats.days", { count: stats.currentStreak })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("stats.longestStreak")}</dt>
              <dd className="text-2xl font-bold" data-testid={TEST_IDS.statsLongest}>
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
                className="flex-1 rounded-t-sm bg-accent"
                style={{ height: `${Math.max(day.count > 0 ? 8 : 2, (day.count / max) * 100)}%` }}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
