"use client";

import { useState } from "react";
import {
  EMPTY_TODO_FORM,
  isValidTitle,
  toTodoDraft,
  type TodoDraft,
  type TodoPriority,
} from "@todo/shared";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

type TodoFormProps = { onAdd: (draft: TodoDraft) => void; existingTags?: readonly string[] };

export function TodoForm({ onAdd, existingTags = [] }: TodoFormProps) {
  const [form, setForm] = useState(EMPTY_TODO_FORM);
  const { title, priority, dueDate, tags } = form;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidTitle(title)) return;
    onAdd(toTodoDraft(form));
    setForm(EMPTY_TODO_FORM);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-3 sm:flex-row sm:flex-wrap sm:items-center dark:border-white/15 dark:bg-white/5"
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
      <input
        value={tags}
        onChange={(event) => setForm((f) => ({ ...f, tags: event.target.value }))}
        list="todo-tag-suggestions"
        placeholder="Tags, comma-separated"
        aria-label="Tags"
        autoComplete="off"
        className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm sm:w-36 dark:border-white/15"
      />
      <datalist id="todo-tag-suggestions">
        {existingTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
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
