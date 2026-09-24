export type TodoPriority = "low" | "medium" | "high";

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type Todo = {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  priority: TodoPriority;
  dueDate?: string;
  subtasks?: Subtask[];
  createdAt: string;
  updatedAt: string;
};

export type TodoFilter = "all" | "active" | "completed";

export type TodoDraft = {
  title: string;
  notes?: string;
  priority?: TodoPriority;
  dueDate?: string;
};
