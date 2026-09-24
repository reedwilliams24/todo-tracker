"use client";

import { useMemo, useState } from "react";
import {
  countRemaining,
  filterTodos,
  searchTodos,
  sortTodos,
  type TodoFilter,
} from "@todo/shared";
import { useTodos } from "@/hooks/use-todos";
import { TodoForm } from "@/components/todo-form";
import { TodoItem } from "@/components/todo-item";
import { VoiceCapture } from "@/components/voice-capture";

const FILTERS: TodoFilter[] = ["all", "active", "completed"];

export function TodoApp() {
  const {
    todos,
    hydrated,
    addTodo,
    addMany,
    toggle,
    rename,
    remove,
    removeMany,
    clearCompleted,
    addSubtask,
    toggleSubtask,
    removeSubtask,
  } = useTodos();
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => sortTodos(searchTodos(filterTodos(todos, filter), query)),
    [todos, filter, query],
  );
  const searching = query.trim().length > 0;
  const remaining = countRemaining(todos);
  const hasCompleted = todos.length > remaining;

  return (
    <section className="flex flex-col gap-4">
      <TodoForm onAdd={addTodo} />
      <VoiceCapture todos={todos} onAddMany={addMany} onUndo={removeMany} />

      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search todos…"
          aria-label="Search todos"
          className="w-full rounded-xl border [&::-webkit-search-cancel-button]:appearance-none border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute inset-y-0 right-2 px-2 text-sm opacity-50 transition hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>

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
          {todos.length === 0
            ? "No todos yet. Add your first one above."
            : searching
              ? `No ${filter === "all" ? "" : `${filter} `}todos match “${query.trim()}”.`
              : `No ${filter} todos.`}
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
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onRemoveSubtask={removeSubtask}
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
