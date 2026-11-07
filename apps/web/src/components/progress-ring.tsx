"use client";

import { TEST_IDS } from "@/domain";
import { useT } from "@/hooks/use-t";

const SIZE = 54;
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Daybook progress ring: today's completions out of today's load. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const t = useT();
  const filled = total > 0 ? (CIRCUMFERENCE * done) / total : 0;
  return (
    <div
      role="img"
      aria-label={t("daybook.progress", { done, total })}
      className="relative grid shrink-0 place-items-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox="0 0 54 54" aria-hidden className="absolute inset-0">
        <circle cx="27" cy="27" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx="27"
          cy="27"
          r={RADIUS}
          fill="none"
          stroke="var(--acc)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          transform="rotate(-90 27 27)"
          className="transition-[stroke-dasharray] duration-300"
        />
      </svg>
      <b data-testid={TEST_IDS.daybookProgress} className="relative text-xs font-bold tabular-nums">
        {done}/{total}
      </b>
    </div>
  );
}
