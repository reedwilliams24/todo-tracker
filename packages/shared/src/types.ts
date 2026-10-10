export type TodoPriority = "low" | "medium" | "high";

export type Todo = {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  priority: TodoPriority;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type TodoFilter = "all" | "active" | "completed";

export type TodoDraft = {
  title: string;
  notes?: string;
  priority?: TodoPriority;
  dueDate?: string;
  tags?: string[];
};
