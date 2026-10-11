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
import { useT } from "@/hooks/use-t";
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
  const t = useT();
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
          data-testid={TEST_IDS.search}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          className="w-full rounded-xl border [&::-webkit-search-cancel-button]:appearance-none border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            data-testid={TEST_IDS.searchClear}
            aria-label={t("search.clear")}
            className="absolute inset-y-0 right-2 px-2 text-sm opacity-70 transition hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex gap-1" role="tablist" aria-label={t("filter.label")}>
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={filter === option}
              onClick={() => setFilter(option)}
              data-testid={TEST_IDS.filter(option)}
              className={`rounded-full px-3 py-1 transition ${
                filter === option
                  ? "bg-foreground text-background"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              {t(`filter.${option}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 opacity-70">
            {t("sort.label")}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as TodoSort)}
              aria-label={t("sort.ariaLabel")}
              data-testid={TEST_IDS.sort}
              className="rounded-lg border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
            >
              {SORTS.map((option) => (
                <option key={option} value={option} data-testid={TEST_IDS.sortOption(option)} className="text-foreground">
                  {t(option === "due" ? "sort.due" : "sort.priority")}
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
              {t(selecting ? "select.done" : "select.enter")}
            </button>
          )}
          {completedCount > 0 && !selecting && (
            <button
              type="button"
              onClick={clearCompleted}
              data-testid={TEST_IDS.clearCompleted}
              className="opacity-70 underline-offset-4 hover:underline hover:opacity-100"
            >
              {t("list.clearCompleted", { count: completedCount })}
            </button>
          )}
        </div>
      </div>

      {selecting && (
        <div
          role="toolbar"
          aria-label={t("bulk.label")}
          data-testid={TEST_IDS.bulkBar}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
        >
          {confirmingDelete ? (
            <>
              <span className="font-medium">
                {t("bulk.confirm", { count: selected.length })}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                data-testid={TEST_IDS.bulkDeleteCancel}
                className="rounded-lg border border-black/10 px-3 py-1 dark:border-white/15"
              >
                {t("bulk.cancel")}
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                data-testid={TEST_IDS.bulkDeleteConfirm}
                className="rounded-lg bg-red-600 px-3 py-1 text-white"
              >
                {t("bulk.delete")}
              </button>
            </>
          ) : (
            <>
              <span data-testid={TEST_IDS.selectedCount} className="opacity-70">
                {t("select.count", { count: selected.length })}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(allVisibleSelected ? [] : visible.map((todo) => todo.id))}
                data-testid={TEST_IDS.selectAll}
                className="underline-offset-4 hover:underline"
              >
                {t(allVisibleSelected ? "select.none" : "select.all")}
              </button>
              <span className="flex-1" />
              <button
                type="button"
                disabled={selected.length === 0}
                onClick={toggleSelectedComplete}
                data-testid={TEST_IDS.bulkToggle}
                className="rounded-lg border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/15"
              >
                {t("bulk.toggle")}
              </button>
              <button
                type="button"
                disabled={selected.length === 0}
                onClick={() => setConfirmingDelete(true)}
                data-testid={TEST_IDS.bulkDelete}
                className="rounded-lg bg-red-600 px-3 py-1 text-white disabled:opacity-40"
              >
                {t("bulk.delete")}
              </button>
            </>
          )}
        </div>
      )}

      {!hydrated ? (
        <p className="py-10 text-center text-sm opacity-70">{t("list.loading")}</p>
      ) : visible.length === 0 ? (
        <p data-testid={TEST_IDS.empty} className="py-10 text-center text-sm opacity-70">
          {todos.length === 0
            ? t("list.empty")
            : searching
              ? filter === "all"
                ? t("list.noMatchAll", { query: query.trim() })
                : t("list.noMatch", { filter: t(`filter.${filter}`).toLowerCase(), query: query.trim() })
              : t("list.emptyFiltered", { filter: t(`filter.${filter}`).toLowerCase() })}
        </p>
      ) : (
        <ul data-testid={TEST_IDS.list} className="flex flex-col gap-2" aria-label={t("list.label")}>
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
        {t("list.remaining", { count: remaining })}
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
            {t("undo.action")}
          </button>
        </div>
      )}
    </section>
  );
}
