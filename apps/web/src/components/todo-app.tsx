"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  countRemaining,
  filterTodos,
  searchTodos,
  sortTodos,
  SORTS,
  type TodoSort,
  type TodoFilter,
} from "@todo/shared";
import { useTodos } from "@/hooks/use-todos";
import { useSort } from "@todo/shared/react";
import { localSortStorage } from "@/lib/storage";
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
    reorder,
    clearCompleted,
  } = useTodos();
  const [sort, setSort] = useSort(localSortStorage);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [query, setQuery] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape" && (!typing || target === searchRef.current)) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visible = useMemo(
    () => sortTodos(searchTodos(filterTodos(todos, filter), query), sort),
    [todos, filter, query, sort],
  );

  function dropOn(targetId: string) {
    if (draggingId && draggingId !== targetId) {
      reorder(
        visible.map((todo) => todo.id),
        draggingId,
        targetId,
      );
      setSort("manual");
    }
    setDraggingId(null);
  }
  const searching = query.trim().length > 0;
  const remaining = countRemaining(todos);
  const hasCompleted = todos.length > remaining;

  return (
    <section className="flex flex-col gap-4">
      <TodoForm onAdd={addTodo} />
      <VoiceCapture todos={todos} onAddMany={addMany} onUndo={removeMany} />

      <div className="relative">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search todos…  ( / )"
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
          <label className="flex items-center gap-1 opacity-70">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as TodoSort)}
              aria-label="Sort todos"
              className="rounded-lg bg-transparent capitalize outline-none"
            >
              {SORTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
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
              drag={
                !searching
                  ? {
                      dragging: draggingId === todo.id,
                      onDragStart: setDraggingId,
                      onDrop: dropOn,
                      onDragEnd: () => setDraggingId(null),
                    }
                  : undefined
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
