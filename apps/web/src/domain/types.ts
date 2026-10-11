export type TodoPriority = "low" | "medium" | "high";

export type ReminderOffset = "at" | "1h" | "1d";

export type Recurrence = "daily" | "weekly" | "monthly";

export type Todo = {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  priority: TodoPriority;
  dueDate?: string;
  reminder?: ReminderOffset;
  recurrence?: Recurrence;
  /** ISO timestamp of the most recent completion; cleared when reopened. */
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TodoFilter = "all" | "active" | "completed";

export type TodoSort = "priority" | "due" | "manual";

export type TodoDraft = {
  title: string;
  notes?: string;
  priority?: TodoPriority;
  dueDate?: string;
  reminder?: ReminderOffset;
  recurrence?: Recurrence;
};
