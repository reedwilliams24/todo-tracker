export const en = {
  "app.title": "Todo Tracker",
  "app.tagline.web": "Local-first tasks, stored in your browser.",
  "app.tagline.mobile": "A tiny local-first todo list.",

  "form.title.placeholder": "What needs doing?",
  "form.title.label": "Todo title",
  "form.priority.label": "Priority",
  "form.dueDate.label": "Due date",
  "form.dueDate.placeholder": "YYYY-MM-DD",
  "form.add": "Add",

  "priority.low": "Low",
  "priority.medium": "Medium",
  "priority.high": "High",

  "filter.label": "Filter todos",
  "filter.all": "All",
  "filter.active": "Active",
  "filter.completed": "Completed",

  "search.placeholder": "Search todos…",
  "search.label": "Search todos",
  "search.clear": "Clear search",

  "list.label": "Todos",
  "list.loading": "Loading…",
  "list.empty": "No todos yet. Add your first one above.",
  "list.emptyFiltered": "No {filter} todos.",
  "list.noMatch": "No {filter} todos match “{query}”.",
  "list.noMatchAll": "No todos match “{query}”.",
  "list.remaining": "{count, plural, one {# task remaining} other {# tasks remaining}}",
  "list.clearCompleted": "Clear completed",

  "item.markComplete": "Mark \"{title}\" as complete",
  "item.markActive": "Mark \"{title}\" as active",
  "item.edit": "Edit \"{title}\"",
  "item.editTitle": "Edit title",
  "item.editHint": "Double-click to edit",
  "item.delete": "Delete \"{title}\"",

  "voice.label": "Voice capture",
  "voice.speak": "Speak your todos",
  "voice.stop": "Stop and add",
  "voice.addThese": "Add these",
  "voice.listening": "Listening… I'll add your todos once you stop talking.",
  "voice.adding": "Adding…",
  "voice.unsupported": "This browser has no speech recognition, so type what you would say instead.",
  "voice.transcript": "Transcript",
  "voice.transcript.placeholder":
    "e.g. remind me to buy milk and then call the dentist tomorrow, also file taxes asap",
  "voice.empty": "No tasks found in that transcript.",
  "voice.added": "Added {count, plural, one {{first}} other {# todos}}",
  "voice.undo": "Undo",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
