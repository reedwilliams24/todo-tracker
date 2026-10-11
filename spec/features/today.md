# Today

Fixtures: [`../fixtures/today.json`](../fixtures/today.json).

What the home-screen widget (Android, iOS) shows. It reads the same stored list as the app; nothing is stored separately.

## Rules

- **Today** is the local calendar date of `now` (local time, like voice ops). Due dates are compared as `YYYY-MM-DD` strings.
- **Summary** (`todaySummary(todos, now, limit = 5)`), using only open (not completed) todos:
  - `todos`: open todos due today or earlier, sorted with `sortByPriority`, then open undated todos, sorted the same way. Todos due after today are left out. The list is cut to the first `limit`.
  - `dueToday`: open todos due exactly today. `overdue`: open todos due before today.
  - `remaining`: every open todo, including future and undated ones.
- **Subtitle** (`todaySubtitle`): `All done` when `remaining` is 0. Otherwise `N overdue · M due today`, leaving out the overdue part when it's 0 (`0 due today` is shown).
- **More label** (`todayMoreLabel`): `+K more` where K = `remaining` − shown todos, or `null` when K ≤ 0.
- **Widget**: the title is `Today`, then the subtitle, one line per todo (`○ Title`, one line, truncated), then the more label. Tapping it opens the app. It redraws whenever the app saves the list, and at least every 30 minutes (Android) or at the next local midnight (iOS) so the date rolls over.
