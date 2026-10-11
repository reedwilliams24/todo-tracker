// Generated from spec/i18n/en.json by `pnpm spec:generate`. Do not edit.

/// Format-argument order for each Localizable.xcstrings key that takes arguments.
let messageArgs: [String: MessageArgs] = [
    "list.emptyFiltered": MessageArgs(["filter"]),
    "list.noMatch": MessageArgs(["filter", "query"]),
    "list.noMatchAll": MessageArgs(["query"]),
    "list.remaining": MessageArgs(["count"], plural: "count"),
    "list.clearCompleted": MessageArgs(["count"]),
    "select.count": MessageArgs(["count"]),
    "select.item": MessageArgs(["title"]),
    "bulk.confirm": MessageArgs(["count"], plural: "count"),
    "item.markComplete": MessageArgs(["title"]),
    "item.markActive": MessageArgs(["title"]),
    "item.edit": MessageArgs(["title"]),
    "item.delete": MessageArgs(["title"]),
    "quickAdd.due": MessageArgs(["date"]),
    "quickAdd.priority": MessageArgs(["priority"]),
    "item.due": MessageArgs(["date"]),
    "item.overdue": MessageArgs(["date"]),
    "stats.days": MessageArgs(["count"]),
    "stats.chart": MessageArgs(["days"]),
    "stats.day": MessageArgs(["date", "count"]),
    "item.recurrence": MessageArgs(["label"]),
    "voice.added": MessageArgs(["count", "first"], plural: "count"),
]
