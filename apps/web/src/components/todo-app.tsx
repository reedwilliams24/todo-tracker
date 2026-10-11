"use client";

import { useMemo, useState } from "react";
import {
  countCompleted,
  countRemaining,
  filterTodos,
  searchTodos,
  SORTS,
  sortTodos,
  TEST_IDS,
  type TodoFilter,
  type TodoSort,
} from "@/domain";
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
    undoable,
    undo,
  } = useTodos();
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TodoSort>("priority");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const visible = useMemo(
    () => sortTodos(searchTodos(filterTodos(todos, filter), query), sort),
    [todos, filter, query, sort],
  );
  const searching = query.trim().length > 0;
  const remaining = countRemaining(todos);
  const completedCount = countCompleted(todos);

  const visibleIds = new Set(visible.map((todo) => todo.id));
  const selected = selectedIds.filter((id) => visibleIds.has(id));
  const allVisibleSelected = visible.length > 0 && selected.length === visible.length;

  function exitSelectMode() {
    setSelecting(false);
    setSelectedIds([]);
    setConfirmingDelete(false);
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleSelectedComplete() {
    toggleMany(selected);
    exitSelectMode();
  }

  function deleteSelected() {
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
          data-testid={TEST_IDS.search}
          className="w-full rounded-xl border [&::-webkit-search-cancel-button]:appearance-none border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            data-testid={TEST_IDS.searchClear}
            className="absolute inset-y-0 right-2 px-2 text-sm opacity-70 transition hover:opacity-100"
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
              data-testid={TEST_IDS.filter(option)}
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
              data-testid={TEST_IDS.sort}
              className="rounded-lg border border-black/10 bg-transparent px-2 py-1 capitalize dark:border-white/15"
            >
              {SORTS.map((option) => (
                <option key={option} value={option} data-testid={TEST_IDS.sortOption(option)} className="text-foreground">
                  {option === "due" ? "due date" : option}
                </option>
              ))}
            </select>
          </label>
          {todos.length > 0 && (
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => (selecting ? exitSelectMode() : setSelecting(true))}
              data-testid={TEST_IDS.selectMode}
              className="opacity-70 underline-offset-4 hover:underline hover:opacity-100"
            >
              {selecting ? "Done" : "Select"}
            </button>
          )}
          {completedCount > 0 && !selecting && (
            <button
              type="button"
              onClick={clearCompleted}
              data-testid={TEST_IDS.clearCompleted}
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
          data-testid={TEST_IDS.bulkBar}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
        >
          {confirmingDelete ? (
            <>
              <span className="font-medium">
                Delete {selected.length} {selected.length === 1 ? "todo" : "todos"}?
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                data-testid={TEST_IDS.bulkDeleteCancel}
                className="rounded-lg border border-black/10 px-3 py-1 dark:border-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                data-testid={TEST_IDS.bulkDeleteConfirm}
                className="rounded-lg bg-red-600 px-3 py-1 text-white"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <span data-testid={TEST_IDS.selectedCount} className="opacity-70">
                {selected.length} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(allVisibleSelected ? [] : visible.map((todo) => todo.id))}
                data-testid={TEST_IDS.selectAll}
                className="underline-offset-4 hover:underline"
              >
                {allVisibleSelected ? "Select none" : "Select all"}
              </button>
              <span className="flex-1" />
              <button
                type="button"
                disabled={selected.length === 0}
                onClick={toggleSelectedComplete}
                data-testid={TEST_IDS.bulkToggle}
                className="rounded-lg border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/15"
              >
                Toggle complete
              </button>
              <button
                type="button"
                disabled={selected.length === 0}
                onClick={() => setConfirmingDelete(true)}
                data-testid={TEST_IDS.bulkDelete}
                className="rounded-lg bg-red-600 px-3 py-1 text-white disabled:opacity-40"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {!hydrated ? (
        <p className="py-10 text-center text-sm opacity-70">Loading…</p>
      ) : visible.length === 0 ? (
        <p data-testid={TEST_IDS.empty} className="py-10 text-center text-sm opacity-70">
          {todos.length === 0
            ? "No todos yet. Add your first one above."
            : searching
              ? `No ${filter === "all" ? "" : `${filter} `}todos match “${query.trim()}”.`
              : `No ${filter} todos.`}
        </p>
      ) : (
        <ul data-testid={TEST_IDS.list} className="flex flex-col gap-2" aria-label="Todos">
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

      <p data-testid={TEST_IDS.remaining} className="text-xs opacity-70" aria-live="polite">
        {remaining} {remaining === 1 ? "task" : "tasks"} remaining
      </p>

      {undoable && (
        <div
          role="status"
          data-testid={TEST_IDS.undoToast}
          aria-live="polite"
          className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-foreground px-4 py-2 text-sm text-background shadow-lg"
        >
          <span data-testid={TEST_IDS.undoLabel}>{undoable.label}</span>
          <button
            type="button"
            onClick={undo}
            data-testid={TEST_IDS.undoAction}
            className="font-medium underline underline-offset-4"
          >
            Undo
          </button>
        </div>
      )}
    </section>
  );
}
