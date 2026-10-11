import {
  computeStats,
  STATS_DAYS,
} from "web/domain";
import { todo, done } from "../helpers";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "stats",
  spec: "features/stats.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    { name: "constants", op: "statsConstants", given: {} },
    { name: "computeStats: no todos", op: "computeStats", given: { todos: [], now: "2026-03-10T15:00:00.000Z", days: 7, timeZone: "UTC" } },
    {
      name: "computeStats: defaults to a 30-day window",
      op: "computeStats",
      given: { todos: [done("a", "2026-03-10T09:00:00.000Z")], now: "2026-03-10T15:00:00.000Z", timeZone: "UTC" },
    },
    {
      name: "computeStats: buckets per day, ignores open, legacy and invalid completions",
      op: "computeStats",
      given: {
        todos: [
          done("a", "2026-03-10T00:30:00.000Z"),
          done("b", "2026-03-10T23:30:00.000Z"),
          done("c", "2026-03-08T12:00:00.000Z"),
          done("old", "2026-02-01T12:00:00.000Z"),
          todo("open", { completedAt: "2026-03-10T10:00:00.000Z" }),
          done("legacy"),
          done("garbage", "not a date"),
        ],
        now: "2026-03-10T15:00:00.000Z",
        days: 7,
        timeZone: "UTC",
      },
    },
    {
      name: "computeStats: days follow the given time zone",
      op: "computeStats",
      given: {
        todos: [done("late", "2026-03-10T03:30:00.000Z"), done("day", "2026-03-10T15:00:00.000Z")],
        now: "2026-03-10T16:00:00.000Z",
        days: 3,
        timeZone: "America/New_York",
      },
    },
    {
      name: "computeStats: current streak survives an open today, longest is the best run",
      op: "computeStats",
      given: {
        todos: [
          done("a", "2026-03-09T12:00:00.000Z"),
          done("b", "2026-03-08T12:00:00.000Z"),
          done("c", "2026-03-01T12:00:00.000Z"),
          done("d", "2026-03-02T12:00:00.000Z"),
          done("e", "2026-03-03T12:00:00.000Z"),
        ],
        now: "2026-03-10T15:00:00.000Z",
        days: 3,
        timeZone: "UTC",
      },
    },
    {
      name: "computeStats: completing today extends the streak",
      op: "computeStats",
      given: {
        todos: [done("a", "2026-03-10T08:00:00.000Z"), done("b", "2026-03-09T12:00:00.000Z"), done("c", "2026-03-08T12:00:00.000Z")],
        now: "2026-03-10T15:00:00.000Z",
        days: 3,
        timeZone: "UTC",
      },
    },
    {
      name: "computeStats: a gap before yesterday resets the current streak",
      op: "computeStats",
      given: { todos: [done("a", "2026-03-07T12:00:00.000Z")], now: "2026-03-10T15:00:00.000Z", days: 3, timeZone: "UTC" },
    },
    {
      name: "computeStats: DST start day chains with its neighbours",
      op: "computeStats",
      given: {
        todos: [
          done("a", "2026-03-07T17:00:00.000Z"),
          done("b", "2026-03-08T16:00:00.000Z"),
          done("c", "2026-03-09T16:00:00.000Z"),
        ],
        now: "2026-03-10T00:30:00.000Z",
        days: 4,
        timeZone: "America/New_York",
      },
    },
    {
      name: "computeStats: window crosses a month and leap day",
      op: "computeStats",
      given: { todos: [done("a", "2028-02-29T12:00:00.000Z")], now: "2028-03-01T12:00:00.000Z", days: 3, timeZone: "UTC" },
    },
  ],
};

export const ops: Ops = {
  statsConstants: () => ({ statsDays: STATS_DAYS }),
  computeStats: (g) => computeStats(g.todos, new Date(g.now), g.days ?? STATS_DAYS, g.timeZone),
};
