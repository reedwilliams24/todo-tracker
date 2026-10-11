"use client";

import { useRef, useState } from "react";
import { useT } from "@/hooks/use-t";
import { isOverdue, isValidTitle, TEST_IDS, type Todo } from "@/domain";

const PRIORITY_STYLES: Record<Todo["priority"], string> = {
  high: "bg-red-500/15 text-red-700 dark:text-red-400",
  medium: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

type TodoItemProps = {
  todo: Todo;
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
};

export function TodoItem({ todo, onToggle, onRename, onRemove, selection, drag }: TodoItemProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(todo.title);
  const cancelled = useRef(false);

  function startEditing() {
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
        className={`flex items-center gap-3 rounded-xl border bg-white/60 px-3 py-2 dark:bg-white/5 ${
          selection.selected ? "border-foreground/60" : "border-black/10 dark:border-white/15"
        }`}
      >
        <input
          type="checkbox"
          checked={selection.selected}
          onChange={() => selection.onSelect(todo.id)}
          data-testid={TEST_IDS.itemSelect(todo.title)}
          aria-label={t("select.item", { title: todo.title })}
          className="size-4 accent-current"
        />
        <button
          type="button"
          onClick={() => selection.onSelect(todo.id)}
          className={`flex-1 truncate text-left ${todo.completed ? "line-through opacity-50" : ""}`}
        >
          {todo.title}
        </button>
        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORITY_STYLES[todo.priority]}`}>
          {todo.priority}
        </span>
      </li>
    );
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
      className={`flex items-center gap-3 rounded-xl border bg-white/60 px-3 py-2 dark:bg-white/5 ${
        overdue ? "border-red-500/40" : "border-black/10 dark:border-white/15"
      } ${drag?.dragging ? "opacity-40" : ""}`}
    >
      {drag && (
        <span aria-label="Drag to reorder" title="Drag to reorder" className="cursor-grab opacity-40 select-none">
          ⋮⋮
        </span>
      )}
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        data-testid={TEST_IDS.itemToggle(todo.title)}
        aria-label={t(todo.completed ? "item.markActive" : "item.markComplete", { title: todo.title })}
        className="size-4 accent-current"
      />

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
          className="flex-1 rounded-lg bg-transparent px-1 py-1 outline-none"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={startEditing}
          data-testid={TEST_IDS.itemTitle(todo.title)}
          aria-label={t("item.edit", { title: todo.title })}
          title={t("item.editHint")}
          className={`flex-1 truncate text-left ${todo.completed ? "line-through opacity-70" : ""}`}
        >
          {todo.title}
        </button>
      )}

      {todo.dueDate && (
        <span
          data-testid={TEST_IDS.itemDueDate(todo.title)}
          className={`text-xs ${overdue ? "font-medium text-red-700 dark:text-red-400" : "opacity-70"}`}
          aria-label={t(overdue ? "item.overdue" : "item.due", { date: todo.dueDate })}
        >
          {overdue && <span data-testid={TEST_IDS.itemOverdue(todo.title)}>{t("item.overdueBadge")}</span>}
          {todo.dueDate}
        </span>
      )}

      {todo.recurrence && (
        <span
          data-testid={TEST_IDS.itemRecurrence(todo.title)}
          className="text-xs opacity-70"
          aria-label={t(`item.repeats.${todo.recurrence}`)}
          title={t(`item.repeats.${todo.recurrence}`)}
        >
          {t("item.recurrence", { label: t(`recurrence.${todo.recurrence}`) })}
        </span>
      )}

      <span
        data-testid={TEST_IDS.itemPriority(todo.title)}
        className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[todo.priority]}`}
      >
        {t(`priority.${todo.priority}`)}
      </span>

      <button
        type="button"
        onClick={() => onRemove(todo.id)}
        data-testid={TEST_IDS.itemDelete(todo.title)}
        aria-label={t("item.delete", { title: todo.title })}
        className="rounded-lg px-2 py-1 text-sm opacity-70 transition hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
