export type TodoPriority = "low" | "medium" | "high";

export type ReminderOffset = "at" | "1h" | "1d";

export type Todo = {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  priority: TodoPriority;
  dueDate?: string;
  reminder?: ReminderOffset;
  createdAt: string;
  updatedAt: string;
};

export type TodoFilter = "all" | "active" | "completed";

export type TodoDraft = {
  title: string;
  notes?: string;
  priority?: TodoPriority;
  dueDate?: string;
  reminder?: ReminderOffset;
};
