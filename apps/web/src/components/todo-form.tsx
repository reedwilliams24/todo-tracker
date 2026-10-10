"use client";

import { useMemo, useState } from "react";
import {
  EMPTY_TODO_FORM,
  hasQuickAddMeta,
  isValidTitle,
  parseQuickAdd,
  quickAddToDraft,
  type TodoDraft,
  type TodoPriority,
} from "@todo/shared";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

export function TodoForm({ onAdd }: { onAdd: (draft: TodoDraft) => void }) {
  const [form, setForm] = useState(EMPTY_TODO_FORM);
  const { title, priority, dueDate } = form;
  const parsed = useMemo(() => parseQuickAdd(title), [title]);
  const canAdd = isValidTitle(parsed.title);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdd) return;
    onAdd(quickAddToDraft(parsed, priority, dueDate));
    setForm(EMPTY_TODO_FORM);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/15 dark:bg-white/5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={title}
        onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
        placeholder="What needs doing? e.g. call mom tomorrow #family !p1"
        aria-label="Todo title"
        className="flex-1 rounded-lg bg-transparent px-2 py-2 outline-none placeholder:opacity-50"
      />
      <select
        value={priority}
        onChange={(event) =>
          setForm((f) => ({ ...f, priority: event.target.value as TodoPriority }))
        }
        aria-label="Priority"
        className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm capitalize dark:border-white/15"
      >
        {PRIORITIES.map((option) => (
          <option key={option} value={option} className="text-foreground">
            {option}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(event) => setForm((f) => ({ ...f, dueDate: event.target.value }))}
        aria-label="Due date"
        className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm dark:border-white/15"
      />
      <button
        type="submit"
        disabled={!canAdd}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
      >
        Add
      </button>
      </div>
      {hasQuickAddMeta(parsed) && (
        <p className="flex flex-wrap gap-x-3 px-2 text-xs opacity-70" data-testid="quick-add-preview">
          <span>
            Will add: <strong className="font-medium">{parsed.title || "…"}</strong>
          </span>
          {parsed.dueDate && <span>Due {parsed.dueDate}</span>}
          {parsed.priority && <span className="capitalize">{parsed.priority} priority</span>}
          {parsed.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>
      )}
    </form>
  );
}
