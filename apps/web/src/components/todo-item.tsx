"use client";

import { useRef, useState } from "react";
import { useT } from "@/hooks/use-t";
import { isOverdue, isValidTitle, subtaskProgress, TEST_IDS, type Todo } from "@/domain";

const PRIORITY_DOTS: Record<Todo["priority"], string> = {
  high: "bg-hi",
  medium: "bg-md",
  low: "bg-lo",
};

/** "Fri" for a due date in the last 6 days, else e.g. "Oct 2", in the browser's locale. */
function slippedFrom(dueDate: string, today: string): string {
  const [y, m, d] = dueDate.split("-").map(Number) as [number, number, number];
  const due = new Date(y, m - 1, d);
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const days = Math.round((new Date(ty, tm - 1, td).getTime() - due.getTime()) / 86_400_000);
  return days <= 6
    ? due.toLocaleDateString(undefined, { weekday: "short" })
    : due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type TodoItemProps = {
  todo: Todo;
  /** Today's YYYY-MM-DD key, for the "from Fri" label on slipped todos. */
  today?: string;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  /** When provided the row is in multi-select mode: the checkbox selects instead of completing. */
  selection?: { selected: boolean; onSelect: (id: string) => void };
  /** Present when the list is manually sortable: drag this row onto another to move it there. */
  drag?: {
    dragging: boolean;
    onDragStart: (id: string) => void;
    onDrop: (targetId: string) => void;
    onDragEnd: () => void;
  };
  onAddSubtask: (id: string, title: string) => void;
  onToggleSubtask: (id: string, subtaskId: string) => void;
  onRemoveSubtask: (id: string, subtaskId: string) => void;
  /** Read-only list (spec/features/realtime.md#connection-status): edits are disabled, expanding still works. */
  readOnly?: boolean;
  /** Why it's read-only, for `aria-describedby` on the disabled controls. */
  describedBy?: string;
};

export function TodoItem({
  todo,
  today,
  onToggle,
  onRename,
  onRemove,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
  selection,
  drag,
  readOnly = false,
  describedBy,
}: TodoItemProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const progress = subtaskProgress(todo);
  const panelId = `subtasks-${todo.id}`;
  const [draftTitle, setDraftTitle] = useState(todo.title);
  const cancelled = useRef(false);

  const locked = readOnly ? { disabled: true, "aria-describedby": describedBy } : {};

  function startEditing() {
    if (readOnly) return;
    cancelled.current = false;
    setDraftTitle(todo.title);
    setEditing(true);
  }

  function cancel() {
    cancelled.current = true;
    setDraftTitle(todo.title);
    setEditing(false);
  }

  function commit() {
    if (cancelled.current) return;
    if (isValidTitle(draftTitle) && draftTitle.trim() !== todo.title) {
      onRename(todo.id, draftTitle);
    } else {
      setDraftTitle(todo.title);
    }
    setEditing(false);
  }

  const overdue = isOverdue(todo);

  if (selection) {
    return (
      <li
        data-testid={TEST_IDS.item(todo.title)}
        data-selected={selection.selected}
        className={`flex items-center gap-3 rounded-[14px] border bg-surface px-3 py-[11px] ${
          selection.selected ? "border-accent bg-soft" : "border-line"
        }`}
      >
        <input
          type="checkbox"
          checked={selection.selected}
          onChange={() => selection.onSelect(todo.id)}
          data-testid={TEST_IDS.itemSelect(todo.title)}
          aria-label={t("select.item", { title: todo.title })}
          className="size-4 accent-[var(--acc)]"
        />
        <button
          type="button"
          onClick={() => selection.onSelect(todo.id)}
          className={`flex-1 truncate text-left ${todo.completed ? "text-muted line-through" : ""}`}
        >
          {todo.title}
        </button>
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${PRIORITY_DOTS[todo.priority]}`} />
      </li>
    );
  }

  function submitSubtask() {
    if (!isValidTitle(subtaskTitle)) return;
    onAddSubtask(todo.id, subtaskTitle);
    setSubtaskTitle("");
  }

  return (
    <li
      data-testid={TEST_IDS.item(todo.title)}
      draggable={!!drag}
      onDragStart={drag ? () => drag.onDragStart(todo.id) : undefined}
      onDragOver={drag ? (event) => event.preventDefault() : undefined}
      onDrop={
        drag
          ? (event) => {
              event.preventDefault();
              drag.onDrop(todo.id);
            }
          : undefined
      }
      onDragEnd={drag?.onDragEnd}
      className={`group flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-3 py-[11px] transition hover:border-[color-mix(in_srgb,var(--acc)_35%,var(--line))] ${
        drag?.dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {drag && (
          <span
            aria-label="Drag to reorder"
            title="Drag to reorder"
            className="-mr-1 cursor-grab text-muted opacity-0 transition select-none group-hover:opacity-60"
          >
            ⋮⋮
          </span>
        )}
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          {...locked}
          data-testid={TEST_IDS.itemToggle(todo.title)}
          aria-label={t(todo.completed ? "item.markActive" : "item.markComplete", { title: todo.title })}
          className="dy-check"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {editing ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") cancel();
              }}
              data-testid={TEST_IDS.itemEditInput}
              aria-label={t("item.editTitle")}
              className="rounded-md bg-soft px-1 py-0.5 text-[15px] font-medium outline-none"
            />
          ) : (
            <button
              type="button"
              aria-disabled={readOnly || undefined}
              aria-describedby={readOnly ? describedBy : undefined}
              onDoubleClick={startEditing}
              data-testid={TEST_IDS.itemTitle(todo.title)}
              aria-label={t("item.edit", { title: todo.title })}
              title={t("item.editHint")}
              className={`truncate text-left text-[15px] font-medium ${todo.completed ? "text-muted line-through" : ""}`}
            >
              {todo.title}
            </button>
          )}
          {(todo.dueDate || todo.reminder || todo.recurrence) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              {todo.dueDate && (
                <span
                  data-testid={TEST_IDS.itemDueDate(todo.title)}
                  className={overdue ? "font-medium text-note" : undefined}
                  aria-label={t(overdue ? "item.overdue" : "item.due", { date: todo.dueDate })}
                >
                  {overdue && (
                    <span data-testid={TEST_IDS.itemOverdue(todo.title)}>
                      {today
                        ? t("item.slippedBadge", { day: slippedFrom(todo.dueDate, today) })
                        : t("item.overdueBadge")}
                    </span>
                  )}
                  {todo.dueDate}
                </span>
              )}
              {todo.reminder && (
                <span
                  data-testid={TEST_IDS.itemReminder(todo.title)}
                  aria-label={t("item.reminder", { label: t(`reminder.${todo.reminder}`).toLowerCase() })}
                  title={t("item.reminder", { label: t(`reminder.${todo.reminder}`).toLowerCase() })}
                >
                  {t(`reminder.${todo.reminder}`)}
                </span>
              )}

              {todo.recurrence && (
                <span
                  data-testid={TEST_IDS.itemRecurrence(todo.title)}
                  aria-label={t(`item.repeats.${todo.recurrence}`)}
                  title={t(`item.repeats.${todo.recurrence}`)}
                >
                  {t("item.recurrence", { label: t(`recurrence.${todo.recurrence}`) })}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={t(expanded ? "subtasks.collapse" : "subtasks.expand", { title: todo.title })}
          data-testid={TEST_IDS.itemSubtasksToggle(todo.title)}
          className="rounded-full bg-soft px-2 py-0.5 text-xs text-muted tabular-nums transition hover:text-ink"
        >
          <span data-testid={TEST_IDS.itemSubtaskProgress(todo.title)}>
            {progress.total > 0 ? `${progress.done}/${progress.total}` : "+"}
          </span>
          <span aria-hidden className="ml-1">
            {expanded ? "▾" : "▸"}
          </span>
        </button>

        <span data-testid={TEST_IDS.itemPriority(todo.title)} className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden className={`size-2 rounded-full ${PRIORITY_DOTS[todo.priority]}`} />
          {t(`priority.${todo.priority}`)}
        </span>

        <button
          type="button"
          onClick={() => onRemove(todo.id)}
          {...locked}
          data-testid={TEST_IDS.itemDelete(todo.title)}
          aria-label={t("item.delete", { title: todo.title })}
          className="rounded-lg px-2 py-1 text-sm text-muted transition hover:text-hi disabled:opacity-30"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="ml-8 flex flex-col gap-1.5 border-t border-line pt-2 text-sm">
          {todo.subtasks?.map((subtask) => (
            <div key={subtask.id} data-testid={TEST_IDS.subtask(subtask.title)} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => onToggleSubtask(todo.id, subtask.id)}
                {...locked}
                data-testid={TEST_IDS.subtaskToggle(subtask.title)}
                aria-label={t(subtask.completed ? "subtask.markActive" : "subtask.markComplete", {
                  title: subtask.title,
                })}
                className="dy-check dy-check-sm"
              />
              <span className={`flex-1 truncate ${subtask.completed ? "text-muted line-through" : ""}`}>
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => onRemoveSubtask(todo.id, subtask.id)}
                {...locked}
                data-testid={TEST_IDS.subtaskDelete(subtask.title)}
                aria-label={t("subtask.delete", { title: subtask.title })}
                className="px-1 text-xs opacity-50 hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
          <input
            value={subtaskTitle}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitSubtask();
              }
            }}
            placeholder={t("subtasks.add.placeholder")}
            {...locked}
            aria-label={t("subtasks.add.label", { title: todo.title })}
            data-testid={TEST_IDS.subtaskInput(todo.title)}
            className="rounded-lg bg-transparent px-1 py-1 outline-none placeholder:opacity-50"
          />
        </div>
      )}
    </li>
  );
}
