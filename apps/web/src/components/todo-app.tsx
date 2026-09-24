"use client";

import { useMemo, useState } from "react";
import { countRemaining, filterTodos, sortTodos, type TodoFilter } from "@todo/shared";
import { useTodos } from "@/hooks/use-todos";
import { TodoForm } from "@/components/todo-form";
import { TodoItem } from "@/components/todo-item";

const FILTERS: TodoFilter[] = ["all", "active", "completed"];

export function TodoApp() {
  const { todos, hydrated, addTodo, toggle, rename, remove, clearCompleted } = useTodos();
  const [filter, setFilter] = useState<TodoFilter>("all");

  const visible = useMemo(() => sortTodos(filterTodos(todos, filter)), [todos, filter]);
  const remaining = countRemaining(todos);
  const hasCompleted = todos.length > remaining;

  return (
    <section className="flex flex-col gap-4">
      <TodoForm onAdd={addTodo} />

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex gap-1" role="tablist" aria-label="Filter todos">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={filter === option}
              onClick={() => setFilter(option)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                filter === option
                  ? "bg-foreground text-background"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {hasCompleted && (
          <button
            type="button"
            onClick={clearCompleted}
            className="opacity-70 underline-offset-4 hover:underline hover:opacity-100"
          >
            Clear completed
          </button>
        )}
      </div>

      {!hydrated ? (
        <p className="py-10 text-center text-sm opacity-60">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm opacity-60">
          {todos.length === 0 ? "No todos yet. Add your first one above." : `No ${filter} todos.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggle}
              onRename={rename}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      <p className="text-xs opacity-60">
        {remaining} {remaining === 1 ? "task" : "tasks"} remaining
      </p>
    </section>
  );
}
