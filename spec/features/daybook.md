# Daybook (Today view, progress ring, Upcoming)

The Daybook shell organises the list around today. Dates are calendar days (`YYYY-MM-DD`) in the
device's time zone; domain functions take `today`/`now` (and a time zone) as input.

## Today sections (`daybookSections`)

Todos are split into four groups. Each group keeps the order of the list it was given (the
user's search, filter and sort apply first).

- **Slipped**: open, `dueDate` before today. Shown first under a calm "Carried over" header; each
  card says where it came from ("from Fri": the weekday of the due date when it is within the last
  6 days, else the short date). Never red.
- **Today**: open, due today or undated.
- **Later**: open, due after today.
- **Done**: completed, collapsed by default (the Completed filter shows it expanded). A todo
  completed while the view is open stays in its group, struck through, until the view is left or
  reloaded, so a mis-tap can be undone in place.

Empty groups are not shown.

## Progress ring (`daybookProgress`)

`done` counts todos whose `completedAt` falls on today (in the given time zone; missing or
invalid timestamps never count). `total` is `done` plus the open todos that are slipped, due
today or undated. Future-dated todos are not part of today's load. The ring shows `done/total`
and the header shows "`total - done` left today".

## Upcoming (`upcomingDays`)

Open todos with a `dueDate` on or after today, one group per date, soonest first, input order
within a day. Completed, slipped and undated todos are not shown. With nothing scheduled, the
view shows an empty state; it never shows placeholder data.

## Shell

Destinations are **Today**, **Upcoming** and **Stats** (the existing stats panel). Web shows
them in a sidebar on wide screens and a bottom tab bar on narrow ones; iOS and Android show a
bottom tab bar. Top 3, important dates, routines and inbox are not part of this shell yet.
