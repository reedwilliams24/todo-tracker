"use client";

import { useMemo, useState } from "react";
import {
  countCompleted,
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
    toggleMany,
    rename,
    remove,
    removeMany,
    clearCompleted,
  } = useTodos();
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visible = useMemo(
    () => sortTodos(searchTodos(filterTodos(todos, filter), query)),
    [todos, filter, query],
  );
  const searching = query.trim().length > 0;
  const remaining = countRemaining(todos);
  const completedCount = countCompleted(todos);
  const hasCompleted = completedCount > 0;

  const visibleIds = new Set(visible.map((todo) => todo.id));
  const selected = selectedIds.filter((id) => visibleIds.has(id));
  const allVisibleSelected = visible.length > 0 && selected.length === visible.length;

  function exitSelectMode() {
    setSelecting(false);
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function completeSelected() {
    toggleMany(selected);
    exitSelectMode();
  }

  function deleteSelected() {
    const n = selected.length;
    if (!window.confirm(`Delete ${n} ${n === 1 ? "todo" : "todos"}? This cannot be undone.`)) return;
    removeMany(selected);
    exitSelectMode();
  }

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
        <div className="flex items-center gap-3">
          {todos.length > 0 && (
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => (selecting ? exitSelectMode() : setSelecting(true))}
              className="opacity-70 underline-offset-4 hover:underline hover:opacity-100"
            >
              {selecting ? "Done" : "Select"}
            </button>
          )}
          {hasCompleted && !selecting && (
            <button
              type="button"
              onClick={clearCompleted}
              className="opacity-70 underline-offset-4 hover:underline hover:opacity-100"
            >
              Clear completed ({completedCount})
            </button>
          )}
        </div>
      </div>

      {selecting && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
        >
          <span className="opacity-70">{selected.length} selected</span>
          <button
            type="button"
            onClick={() => setSelectedIds(allVisibleSelected ? [] : visible.map((todo) => todo.id))}
            className="underline-offset-4 hover:underline"
          >
            {allVisibleSelected ? "Select none" : "Select all"}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={completeSelected}
            className="rounded-lg border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/15"
          >
            Toggle complete
          </button>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={deleteSelected}
            className="rounded-lg bg-red-600 px-3 py-1 text-white disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      )}

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
              selection={
                selecting ? { selected: selected.includes(todo.id), onSelect: toggleSelected } : undefined
              }
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
