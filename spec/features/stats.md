# Stats

Fixtures: [`../fixtures/stats.json`](../fixtures/stats.json).

`computeStats(todos, now, days = 30, timeZone)` powers the Stats panel: completions per day for the last `days` days plus current and longest streaks. Apps pass the device time zone; fixtures always pass an IANA `timeZone` so every runner gets the same calendar days.

## Rules

- Only todos with `completed: true` and a valid `completedAt` timestamp count. Open todos, completed todos without `completedAt` (data from before REED-19) and unparsable timestamps are ignored.
- A completion belongs to the calendar day of `completedAt` in `timeZone`.
- `perDay` has exactly `days` entries `{ date: "YYYY-MM-DD", count }`, oldest first, ending with today (the day of `now` in `timeZone`). Days with no completions have `count: 0`.
- `totalCompleted` counts every completion, including ones outside the window.
- `currentStreak`: consecutive days with at least one completion, ending today, or ending yesterday when nothing is completed yet today (today doesn't break a streak until it's over). `0` otherwise.
- `longestStreak`: the longest run of consecutive days with a completion, ever.
- Days are calendar dates, so DST changes never skip or repeat a day.
- `constants.statsDays` is the default window (`30`).

## UI

A collapsed "Stats" section under the list. `statsToggle` shows or hides it; open, it shows `statsTotal` (e.g. `1`), `statsCurrent` and `statsLongest` (e.g. `1d`), and a 30-bar chart (`statsChart`).
