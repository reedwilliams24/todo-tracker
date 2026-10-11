"use client";

import { useMemo, useState } from "react";
import { useT } from "@/hooks/use-t";
import {
  EMPTY_TODO_FORM,
  hasQuickAddMeta,
  isValidTitle,
  parseQuickAdd,
  quickAddToDraft,
  TEST_IDS,
  type TodoDraft,
  type TodoPriority,
} from "@/domain";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

export function TodoForm({ onAdd }: { onAdd: (draft: TodoDraft) => void }) {
  const t = useT();
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
          placeholder={t("form.title.placeholder")}
          aria-label={t("form.title.label")}
          data-testid={TEST_IDS.formTitle}
          className="flex-1 rounded-lg bg-transparent px-2 py-2 outline-none placeholder:opacity-50"
        />
        <select
          value={priority}
          onChange={(event) =>
            setForm((f) => ({ ...f, priority: event.target.value as TodoPriority }))
          }
          aria-label={t("form.priority.label")}
          data-testid={TEST_IDS.formPriority}
          className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm dark:border-white/15"
        >
          {PRIORITIES.map((option) => (
            <option
              key={option}
              value={option}
              data-testid={TEST_IDS.formPriorityOption(option)}
              className="text-foreground"
            >
              {t(`priority.${option}`)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setForm((f) => ({ ...f, dueDate: event.target.value }))}
          aria-label={t("form.dueDate.label")}
          data-testid={TEST_IDS.formDueDate}
          className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm dark:border-white/15"
        />
        <button
          type="submit"
          data-testid={TEST_IDS.formSubmit}
          disabled={!canAdd}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {t("form.add")}
        </button>
      </div>
      {hasQuickAddMeta(parsed) && (
        <p className="flex flex-wrap gap-x-3 px-2 text-xs opacity-70" data-testid={TEST_IDS.quickAddPreview}>
          <span>
            {t("quickAdd.willAdd")}{" "}
            <strong className="font-medium" data-testid={TEST_IDS.quickAddPreviewTitle}>
              {parsed.title || "…"}
            </strong>
          </span>
          {parsed.dueDate && <span>{t("quickAdd.due", { date: parsed.dueDate })}</span>}
          {parsed.priority && <span>{t("quickAdd.priority", { priority: t(`priority.${parsed.priority}`) })}</span>}
          {parsed.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>
      )}
    </form>
  );
}
