"use client";

import { useRef, useState } from "react";
import { isValidTitle, subtaskProgress, type Todo } from "@todo/shared";

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
  onAddSubtask: (id: string, title: string) => void;
  onToggleSubtask: (id: string, subtaskId: string) => void;
  onRemoveSubtask: (id: string, subtaskId: string) => void;
};

export function TodoItem({
  todo,
  onToggle,
  onRename,
  onRemove,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const progress = subtaskProgress(todo);
  const panelId = `subtasks-${todo.id}`;

  function submitSubtask() {
    if (!isValidTitle(subtaskTitle)) return;
    onAddSubtask(todo.id, subtaskTitle);
    setSubtaskTitle("");
  }
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
    <li className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-2 dark:border-white/15 dark:bg-white/5">
      <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        aria-label={`Mark "${todo.title}" as ${todo.completed ? "active" : "complete"}`}
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
          aria-label="Edit title"
          className="flex-1 rounded-lg bg-transparent px-1 py-1 outline-none"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={startEditing}
          aria-label={`Edit "${todo.title}"`}
          title="Double-click to edit"
          className={`flex-1 truncate text-left ${todo.completed ? "line-through opacity-50" : ""}`}
        >
          {todo.title}
        </button>
      )}

      {todo.dueDate && <span className="text-xs opacity-60">{todo.dueDate}</span>}

      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${expanded ? "Collapse" : "Expand"} subtasks of "${todo.title}"`}
        className="rounded-full bg-black/5 px-2 py-0.5 text-xs tabular-nums opacity-70 transition hover:opacity-100 dark:bg-white/10"
      >
        {progress.total > 0 ? `${progress.done}/${progress.total}` : "+"}
        <span aria-hidden className="ml-1">{expanded ? "▾" : "▸"}</span>
      </button>

      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORITY_STYLES[todo.priority]}`}>
        {todo.priority}
      </span>

      <button
        type="button"
        onClick={() => onRemove(todo.id)}
        aria-label={`Delete "${todo.title}"`}
        className="rounded-lg px-2 py-1 text-sm opacity-50 transition hover:opacity-100"
      >
        ×
      </button>
      </div>

      {expanded && (
        <div id={panelId} className="ml-7 flex flex-col gap-1 text-sm">
          {todo.subtasks?.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => onToggleSubtask(todo.id, subtask.id)}
                aria-label={`Mark subtask "${subtask.title}" as ${subtask.completed ? "active" : "complete"}`}
                className="size-3.5 accent-current"
              />
              <span className={`flex-1 truncate ${subtask.completed ? "line-through opacity-50" : ""}`}>
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => onRemoveSubtask(todo.id, subtask.id)}
                aria-label={`Delete subtask "${subtask.title}"`}
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
            placeholder="Add a subtask and press Enter"
            aria-label={`New subtask for "${todo.title}"`}
            className="rounded-lg bg-transparent px-1 py-1 outline-none placeholder:opacity-50"
          />
        </div>
      )}
    </li>
  );
}
