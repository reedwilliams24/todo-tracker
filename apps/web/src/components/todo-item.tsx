"use client";

import { useRef, useState } from "react";
import { useT } from "@/hooks/use-t";
import { isValidTitle, type Todo } from "@todo/shared";

const PRIORITY_STYLES: Record<Todo["priority"], string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  low: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
};

export function TodoItem({ todo, onToggle, onRename, onRemove }: TodoItemProps) {
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

  return (
    <li className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-3 py-2 dark:border-white/15 dark:bg-white/5">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
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
          aria-label={t("item.editTitle")}
          className="flex-1 rounded-lg bg-transparent px-1 py-1 outline-none"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={startEditing}
          aria-label={t("item.edit", { title: todo.title })}
          title={t("item.editHint")}
          className={`flex-1 truncate text-left ${todo.completed ? "line-through opacity-50" : ""}`}
        >
          {todo.title}
        </button>
      )}

      {todo.dueDate && <span className="text-xs opacity-60">{todo.dueDate}</span>}

      <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[todo.priority]}`}>
        {t(`priority.${todo.priority}`)}
      </span>

      <button
        type="button"
        onClick={() => onRemove(todo.id)}
        aria-label={t("item.delete", { title: todo.title })}
        className="rounded-lg px-2 py-1 text-sm opacity-50 transition hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
