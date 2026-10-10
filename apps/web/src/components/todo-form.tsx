"use client";

import { useState } from "react";
import { useT } from "@/hooks/use-t";
import {
  EMPTY_TODO_FORM,
  isValidTitle,
  toTodoDraft,
  type TodoDraft,
  type TodoPriority,
} from "@todo/shared";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

export function TodoForm({ onAdd }: { onAdd: (draft: TodoDraft) => void }) {
  const t = useT();
  const [form, setForm] = useState(EMPTY_TODO_FORM);
  const { title, priority, dueDate } = form;

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
        placeholder={t("form.title.placeholder")}
        aria-label={t("form.title.label")}
        className="flex-1 rounded-lg bg-transparent px-2 py-2 outline-none placeholder:opacity-50"
      />
      <select
        value={priority}
        onChange={(event) =>
          setForm((f) => ({ ...f, priority: event.target.value as TodoPriority }))
        }
        aria-label={t("form.priority.label")}
        className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm dark:border-white/15"
      >
        {PRIORITIES.map((option) => (
          <option key={option} value={option} className="text-foreground">
            {t(`priority.${option}`)}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(event) => setForm((f) => ({ ...f, dueDate: event.target.value }))}
        aria-label={t("form.dueDate.label")}
        className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm dark:border-white/15"
      />
      <button
        type="submit"
        disabled={!isValidTitle(title)}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
      >
        {t("form.add")}
      </button>
    </form>
  );
}
