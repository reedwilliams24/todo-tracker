"use client";

import { useMemo, useState } from "react";
import { computeStats, TEST_IDS, type Todo } from "@/domain";

export function StatsPanel({ todos }: { todos: readonly Todo[] }) {
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
        <span className="font-medium">Stats</span>
        <span className="opacity-60">{open ? "Hide" : "Show"}</span>
      </button>
      {stats && (
        <div id="stats-panel" className="mt-3 flex flex-col gap-3">
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <dt className="text-xs opacity-60">Completed</dt>
              <dd className="text-lg font-semibold" data-testid={TEST_IDS.statsTotal}>
                {stats.totalCompleted}
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">Current streak</dt>
              <dd className="text-lg font-semibold" data-testid={TEST_IDS.statsCurrent}>
                {stats.currentStreak}d
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-60">Longest streak</dt>
              <dd className="text-lg font-semibold" data-testid={TEST_IDS.statsLongest}>
                {stats.longestStreak}d
              </dd>
            </div>
          </dl>
          <ol
            className="flex h-16 items-end gap-px"
            aria-label="Completed per day, last 30 days"
            data-testid={TEST_IDS.statsChart}
          >
            {stats.perDay.map((day) => (
              <li
                key={day.date}
                title={`${day.date}: ${day.count}`}
                aria-label={`${day.date}: ${day.count} completed`}
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
