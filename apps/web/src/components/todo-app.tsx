"use client";

import type { ReactNode } from "react";
import { CalendarIcon, ChartIcon, SunIcon } from "@/components/daybook-icons";
import { ProgressRing } from "@/components/progress-ring";
import { ThemeToggle } from "@/components/theme-toggle";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  canEdit,
  connectionStatus,
  countCompleted,
  countRemaining,
  daybookProgress,
  daybookSections,
  localDateKey,
  upcomingDays,
  type Todo,
  filterTodos,
  searchTodos,
  SORTS,
  sortTodos,
  TEST_IDS,
  type TodoFilter,
  type TodoSort,
  type TodoStorage,
} from "@/domain";
import { useT } from "@/hooks/use-t";
import { useTodos, type SyncSetup } from "@/hooks/use-todos";
import { useReminders } from "@/hooks/use-reminders";
import { useSort } from "@/domain/react";
import { localSortStorage } from "@/lib/storage";
import { TodoForm } from "@/components/todo-form";
import { TodoItem } from "@/components/todo-item";
import { VoiceCapture } from "@/components/voice-capture";
import { StatsPanel } from "@/components/stats-panel";
import { CONNECTION_BANNER_ID, ConnectionBanner } from "@/components/connection-banner";
import { useOnline } from "@/hooks/use-online";

const FILTERS: TodoFilter[] = ["all", "active", "completed"];
const TABS = ["today", "upcoming", "stats"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS = { today: SunIcon, upcoming: CalendarIcon, stats: ChartIcon } satisfies Record<Tab, unknown>;
const SECTIONS = ["slipped", "today", "later"] as const;

function greetingKey(now: Date) {
  const hour = now.getHours();
  return hour < 12 ? "daybook.greeting.morning" : hour < 18 ? "daybook.greeting.afternoon" : "daybook.greeting.evening";
}

/** "Tomorrow", "Today" or e.g. "Wed, Oct 14" for a YYYY-MM-DD key, in the browser's locale. */
function dayLabel(date: string, today: string, t: ReturnType<typeof useT>) {
  if (date === today) return t("upcoming.today");
  if (date === addDays(today, 1)) return t("upcoming.tomorrow");
  return parseKey(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function addDays(key: string, days: number) {
  const date = parseKey(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

type TodoAppProps = {
  storage?: TodoStorage;
  sync?: SyncSetup | null;
  /** Account menu, shown in the sidebar (signed-in builds only). */
  account?: ReactNode;
  /** Shown above the current view (e.g. the guest banner). */
  banner?: ReactNode;
  /** The account's session expired: the list stays visible but read-only until the user signs in again. */
  expired?: boolean;
};

export function TodoApp({ storage, sync, account, banner, expired = false }: TodoAppProps) {
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
    reorder,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    pushFailed,
    connection,
  } = useTodos(storage, sync);
  const t = useT();
  const online = useOnline();
  const status = connectionStatus({ account: !!sync || expired, expired, online, connection });
  const editable = canEdit(status);
  const describedBy = editable || status === "expired" ? undefined : CONNECTION_BANNER_ID;
  const [sort, setSort] = useSort(localSortStorage);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [query, setQuery] = useState("");
  const { permission, request } = useReminders(todos);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [now, setNow] = useState<Date | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  // Todos seen open on this view. Completing one keeps it in place (struck through) until the view is left.
  const seenOpen = useRef(new Set<string>());

  useEffect(() => {
    if (editable) return;
    setSelecting(false);
    setSelectedIds([]);
    setConfirmingDelete(false);
    setDraggingId(null);
  }, [editable]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function goTo(next: Tab) {
    setTab(next);
    seenOpen.current = new Set();
    if (next !== "today") exitSelectMode();
  }

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

  const today = now ? localDateKey(now) : "";
  const progress = now ? daybookProgress(todos, now) : { done: 0, total: 0 };
  const byId = new Map(visible.map((todo) => [todo.id, todo]));
  for (const todo of todos) if (!todo.completed) seenOpen.current.add(todo.id);
  const grouped = daybookSections(
    visible.map((todo) => (todo.completed && seenOpen.current.has(todo.id) ? { ...todo, completed: false } : todo)),
    today,
  );
  const sections = {
    slipped: grouped.slipped.map((todo) => byId.get(todo.id)!),
    today: grouped.today.map((todo) => byId.get(todo.id)!),
    later: grouped.later.map((todo) => byId.get(todo.id)!),
    done: grouped.done.map((todo) => byId.get(todo.id)!),
  };
  const showDone = doneOpen || filter === "completed";
  const upcoming = upcomingDays(sortTodos(todos, sort), today);

  function renderItem(todo: Todo, { reorderable = true } = {}) {
    return (
      <TodoItem
        key={todo.id}
        todo={todo}
        today={today}
        onToggle={toggle}
        onRename={rename}
        onRemove={remove}
        selection={selecting ? { selected: selected.includes(todo.id), onSelect: toggleSelected } : undefined}
        readOnly={!editable}
        describedBy={describedBy}
        drag={
          reorderable && !searching && !selecting && editable
            ? {
                dragging: draggingId === todo.id,
                onDragStart: setDraggingId,
                onDrop: dropOn,
                onDragEnd: () => setDraggingId(null),
              }
            : undefined
        }
        onAddSubtask={addSubtask}
        onToggleSubtask={toggleSubtask}
        onRemoveSubtask={removeSubtask}
      />
    );
  }

  function sectionHeader(section: keyof typeof sections, trailing?: ReactNode) {
    return (
      <h3
        data-testid={TEST_IDS.daybookSection(section)}
        className="flex items-center gap-2 px-1 text-[13px] font-bold tracking-tight"
      >
        {t(`daybook.section.${section}`)}
        <span className="font-medium text-muted tabular-nums">{sections[section].length}</span>
        {trailing}
      </h3>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="flex items-center justify-between gap-3 px-4 pt-6 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:justify-start md:gap-0 md:border-r md:border-line md:bg-surface md:py-6">
        <div className="flex items-center gap-2.5 md:px-2">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-[10px] bg-accent text-sm font-bold text-accent-ink"
          >
            ✓
          </span>
          <h1 className="text-lg font-bold tracking-tight">{t("app.title")}</h1>
        </div>
        <nav
          aria-label={t("nav.label")}
          className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:static md:mt-8 md:flex-col md:gap-1 md:border-0 md:bg-transparent md:p-0"
        >
          {TABS.map((option) => {
            const Icon = TAB_ICONS[option];
            const active = tab === option;
            return (
              <button
                key={option}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => goTo(option)}
                data-testid={option === "stats" ? TEST_IDS.statsToggle : TEST_IDS.tab(option)}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition md:flex-none md:flex-row md:gap-3 md:rounded-[10px] md:px-3 md:py-2 md:text-sm ${
                  active ? "text-accent md:bg-soft" : "text-muted hover:text-ink"
                }`}
              >
                <Icon />
                {t(`nav.${option}`)}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 md:mt-auto md:flex-col md:items-start md:px-2">
          {account}
          <ThemeToggle />
        </div>
      </aside>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-12">
        {banner}
        {tab === "today" && (
          <>
            <header className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-muted">{now ? t(greetingKey(now)) : "\u00a0"}</p>
                <h2 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">
                  {now
                    ? now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
                    : "\u00a0"}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-right text-sm text-muted">
                  {t("daybook.left", { count: progress.total - progress.done })}
                </span>
                <ProgressRing done={progress.done} total={progress.total} />
              </div>
            </header>
            <ConnectionBanner status={status} />
            <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(21,24,51,0.04)]">
              <TodoForm onAdd={addTodo} disabled={!editable} describedBy={describedBy} />
              <VoiceCapture
                todos={todos}
                onAddMany={addMany}
                onUndo={removeMany}
                disabled={!editable}
                describedBy={describedBy}
              />
            </div>
            {permission === "default" && (
              <button
                type="button"
                onClick={request}
                className="self-start text-xs underline opacity-60 hover:opacity-100"
              >
                Enable due-date notifications
              </button>
            )}
            {permission === "denied" && <p className="text-xs text-muted">{t("reminder.blocked")}</p>}

            <div className="relative">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                data-testid={TEST_IDS.search}
                placeholder={t("search.placeholder.web")}
                aria-label={t("search.label")}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent [&::-webkit-search-cancel-button]:appearance-none"
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
                      filter === option ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"
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
                    className="rounded-lg border border-line bg-transparent px-2 py-1"
                  >
                    {SORTS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        data-testid={TEST_IDS.sortOption(option)}
                        className="text-foreground"
                      >
                        {t(`sort.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {todos.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={selecting}
                    onClick={() => (selecting ? exitSelectMode() : setSelecting(true))}
                    disabled={!editable}
                    aria-describedby={describedBy}
                    data-testid={TEST_IDS.selectMode}
                    className="underline-offset-4 opacity-70 hover:underline hover:opacity-100 disabled:opacity-30 disabled:hover:no-underline"
                  >
                    {t(selecting ? "select.done" : "select.enter")}
                  </button>
                )}
                {completedCount > 0 && !selecting && (
                  <button
                    type="button"
                    onClick={clearCompleted}
                    disabled={!editable}
                    aria-describedby={describedBy}
                    data-testid={TEST_IDS.clearCompleted}
                    className="underline-offset-4 opacity-70 hover:underline hover:opacity-100 disabled:opacity-30 disabled:hover:no-underline"
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
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              >
                {confirmingDelete ? (
                  <>
                    <span className="font-medium">{t("bulk.confirm", { count: selected.length })}</span>
                    <span className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      data-testid={TEST_IDS.bulkDeleteCancel}
                      className="rounded-lg border border-line px-3 py-1"
                    >
                      {t("bulk.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelected}
                      data-testid={TEST_IDS.bulkDeleteConfirm}
                      className="rounded-lg bg-hi px-3 py-1 text-white"
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
                      className="rounded-lg border border-line px-3 py-1 disabled:opacity-40"
                    >
                      {t("bulk.toggle")}
                    </button>
                    <button
                      type="button"
                      disabled={selected.length === 0}
                      onClick={() => setConfirmingDelete(true)}
                      data-testid={TEST_IDS.bulkDelete}
                      className="rounded-lg bg-hi px-3 py-1 text-white disabled:opacity-40"
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
              <div data-testid={TEST_IDS.list} aria-label={t("list.label")} className="flex flex-col gap-5">
                {SECTIONS.filter((section) => sections[section].length > 0).map((section) => (
                  <section key={section} className="flex flex-col gap-2">
                    {sectionHeader(section)}
                    <ul className="flex flex-col gap-2">{sections[section].map((todo) => renderItem(todo))}</ul>
                  </section>
                ))}
                {sections.done.length > 0 && (
                  <section className="flex flex-col gap-2">
                    {sectionHeader(
                      "done",
                      filter !== "completed" && (
                        <button
                          type="button"
                          onClick={() => setDoneOpen((open) => !open)}
                          aria-expanded={showDone}
                          data-testid={TEST_IDS.daybookDoneToggle}
                          className="ml-auto text-xs font-medium text-accent"
                        >
                          {t(showDone ? "daybook.done.hide" : "daybook.done.show")}
                        </button>
                      ),
                    )}
                    <ul hidden={!showDone} className="flex flex-col gap-2">
                      {sections.done.map((todo) => renderItem(todo))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            <p data-testid={TEST_IDS.remaining} className="text-xs opacity-70" aria-live="polite">
              {t("list.remaining", { count: remaining })}
            </p>
          </>
        )}

        {tab === "upcoming" && (
          <>
            <header className="flex flex-col gap-0.5">
              <h2 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">{t("upcoming.title")}</h2>
              <p className="text-sm text-muted">{t("upcoming.subtitle")}</p>
            </header>
            {!hydrated || !now ? (
              <p className="py-10 text-center text-sm text-muted">{t("list.loading")}</p>
            ) : upcoming.length === 0 ? (
              <p data-testid={TEST_IDS.upcomingEmpty} className="py-10 text-center text-sm text-muted">
                {t("upcoming.empty")}
              </p>
            ) : (
              <div data-testid={TEST_IDS.upcomingList} className="flex flex-col gap-5">
                {upcoming.map((day) => (
                  <section key={day.date} data-testid={TEST_IDS.upcomingDay(day.date)} className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 px-1 text-[13px] font-bold tracking-tight">
                      {dayLabel(day.date, today, t)}
                      <span className="font-medium text-muted tabular-nums">{day.todos.length}</span>
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {day.todos.map((todo) => renderItem(todo, { reorderable: false }))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "stats" && (
          <>
            <h2 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">{t("stats.title")}</h2>
            <StatsPanel todos={todos} />
          </>
        )}
      </div>

      {undoable && (
        <div
          role="status"
          data-testid={TEST_IDS.undoToast}
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-foreground px-4 py-2 text-sm text-background shadow-lg md:bottom-6"
        >
          <span data-testid={TEST_IDS.undoLabel}>{undoable.label}</span>
          <button
            type="button"
            onClick={undo}
            disabled={!editable}
            aria-describedby={describedBy}
            data-testid={TEST_IDS.undoAction}
            className="font-medium underline underline-offset-4 disabled:opacity-50"
          >
            {t("undo.action")}
          </button>
        </div>
      )}

      {pushFailed && (
        <div
          role="alert"
          data-testid={TEST_IDS.syncError}
          className="fixed bottom-36 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-hi px-4 py-2 text-sm text-white shadow-lg md:bottom-20"
        >
          {t("sync.pushFailed")}
        </div>
      )}
    </div>
  );
}
