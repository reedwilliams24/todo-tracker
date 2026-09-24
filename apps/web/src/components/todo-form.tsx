"use client";

import { useState } from "react";
import {
  EMPTY_TODO_FORM,
  isValidTitle,
  RECURRENCES,
  RECURRENCE_LABELS,
  toTodoDraft,
  type Recurrence,
  type TodoDraft,
  type TodoPriority,
} from "@todo/shared";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

export function TodoForm({ onAdd }: { onAdd: (draft: TodoDraft) => void }) {
  const [form, setForm] = useState(EMPTY_TODO_FORM);
  const { title, priority, dueDate, recurrence } = form;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidTitle(title)) return;
    onAdd(toTodoDraft(form));
    setForm(EMPTY_TODO_FORM);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-3 sm:flex-row sm:items-center dark:border-white/15 dark:bg-white/5"
    >
      <input
        value={title}
        onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
        placeholder="What needs doing?"
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
      <select
        value={recurrence}
        onChange={(event) =>
          setForm((f) => ({ ...f, recurrence: event.target.value as Recurrence | "" }))
        }
        aria-label="Repeat"
        className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm dark:border-white/15"
      >
        <option value="" className="text-foreground">
          No repeat
        </option>
        {RECURRENCES.map((option) => (
          <option key={option} value={option} className="text-foreground">
            {RECURRENCE_LABELS[option]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!isValidTitle(title)}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}
