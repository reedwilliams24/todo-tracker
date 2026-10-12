"use client";

import { useMemo, useState } from "react";
import { useT } from "@/hooks/use-t";
import {
  EMPTY_TODO_FORM,
  REMINDER_OFFSETS,
  hasQuickAddMeta,
  isValidTitle,
  parseQuickAdd,
  quickAddToDraft,
  RECURRENCES,
  TEST_IDS,
  type ReminderOffset,
  type Recurrence,
  type TodoDraft,
  type TodoPriority,
} from "@/domain";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

export function TodoForm({
  onAdd,
  disabled = false,
  describedBy,
}: {
  onAdd: (draft: TodoDraft) => void;
  /** Read-only list (spec/features/realtime.md#connection-status). */
  disabled?: boolean;
  describedBy?: string;
}) {
  const t = useT();
  const [form, setForm] = useState(EMPTY_TODO_FORM);
  const { title, priority, dueDate, reminder, recurrence } = form;
  const parsed = useMemo(() => parseQuickAdd(title), [title]);
  const canAdd = isValidTitle(parsed.title);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdd || disabled) return;
    const draft = { ...quickAddToDraft(parsed, priority, dueDate), recurrence: recurrence || undefined };
    onAdd(draft.dueDate && reminder ? { ...draft, reminder } : draft);
    setForm(EMPTY_TODO_FORM);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-3">
      <fieldset disabled={disabled} aria-describedby={describedBy} className="contents disabled:opacity-50">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
            placeholder={t("form.title.placeholder")}
            aria-label={t("form.title.label")}
            data-testid={TEST_IDS.formTitle}
            className="min-w-0 basis-full rounded-lg bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted"
          />
          <select
            value={priority}
            onChange={(event) => setForm((f) => ({ ...f, priority: event.target.value as TodoPriority }))}
            aria-label={t("form.priority.label")}
            data-testid={TEST_IDS.formPriority}
            className="rounded-lg border border-line bg-transparent px-2 py-2 text-sm"
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
            className="rounded-lg border border-line bg-transparent px-2 py-2 text-sm"
          />
          <select
            value={reminder}
            disabled={!dueDate}
            onChange={(event) => setForm((f) => ({ ...f, reminder: event.target.value as ReminderOffset | "" }))}
            aria-label={t("form.reminder.label")}
            data-testid={TEST_IDS.formReminder}
            className="rounded-lg border border-line bg-transparent px-2 py-2 text-sm disabled:opacity-40"
          >
            <option value="">{t("reminder.none")}</option>
            {REMINDER_OFFSETS.map((option) => (
              <option
                key={option}
                value={option}
                data-testid={TEST_IDS.formReminderOption(option)}
                className="text-foreground"
              >
                {t(`reminder.${option}`)}
              </option>
            ))}
          </select>
          <select
            value={recurrence}
            onChange={(event) => setForm((f) => ({ ...f, recurrence: event.target.value as Recurrence | "" }))}
            aria-label={t("form.recurrence.label")}
            data-testid={TEST_IDS.formRecurrence}
            className="rounded-lg border border-line bg-transparent px-2 py-2 text-sm"
          >
            <option value="" className="text-foreground">
              {t("recurrence.none")}
            </option>
            {RECURRENCES.map((option) => (
              <option key={option} value={option} className="text-foreground">
                {t(`recurrence.${option}`)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            data-testid={TEST_IDS.formSubmit}
            disabled={!canAdd}
            className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-40"
          >
            {t("form.add")}
          </button>
        </div>
        {hasQuickAddMeta(parsed) && (
          <p className="flex flex-wrap gap-x-3 px-2 text-xs text-muted" data-testid={TEST_IDS.quickAddPreview}>
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
      </fieldset>
    </form>
  );
}
