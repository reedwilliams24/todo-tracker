"use client";

import { ImageIcon } from "@/components/daybook-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEST_IDS, type ImageImportError, type Todo, type TodoDraft } from "@/domain";
import { useT } from "@/hooks/use-t";
import { importTodosFromImage } from "@/lib/image-todos";

type Props = {
  onAddMany: (drafts: TodoDraft[]) => Todo[];
  onUndo: (ids: string[]) => void;
  /** Read-only list (spec/features/realtime.md#connection-status). */
  disabled?: boolean;
  describedBy?: string;
};

type Status =
  | { kind: "reading" }
  | { kind: "added"; ids: string[]; first: string }
  | { kind: "empty" }
  | { kind: "error"; error: ImageImportError };

/** Paste (anywhere on the page) or pick an image and add the todos AI finds in it (spec/features/image-import.md). */
export function ImageImport({ onAddMany, onUndo, disabled = false, describedBy }: Props) {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = status?.kind === "reading";
  const blocked = useRef(false);
  blocked.current = disabled || busy;

  const importImage = useCallback(
    async (file: Blob) => {
      if (blocked.current) return;
      blocked.current = true;
      setStatus({ kind: "reading" });
      const result = await importTodosFromImage(file);
      if ("error" in result) return setStatus({ kind: "error", error: result.error });
      if (result.todos.length === 0) return setStatus({ kind: "empty" });
      const added = onAddMany(result.todos);
      setStatus({ kind: "added", ids: added.map((todo) => todo.id), first: added[0]?.title ?? "" });
    },
    [onAddMany],
  );

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      void importImage(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importImage]);

  return (
    <section
      aria-label={t("image.import")}
      className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-3"
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || busy}
        aria-describedby={disabled ? describedBy : undefined}
        aria-label={t("image.import")}
        title={t("image.import")}
        data-testid={TEST_IDS.imageImportButton}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-soft text-accent shadow-sm transition disabled:opacity-40"
      >
        <ImageIcon width={20} height={20} />
      </button>
      <span className="text-sm text-muted">{t("image.hint")}</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        data-testid={TEST_IDS.imageImportInput}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importImage(file);
        }}
      />
      {status && (
        <ImageImportStatus
          status={status}
          disabled={disabled}
          onUndo={(ids) => {
            onUndo(ids);
            setStatus(null);
          }}
        />
      )}
    </section>
  );
}

function ImageImportStatus({
  status,
  disabled,
  onUndo,
}: {
  status: Status;
  disabled: boolean;
  onUndo: (ids: string[]) => void;
}) {
  const t = useT();
  const text =
    status.kind === "reading"
      ? t("image.reading")
      : status.kind === "added"
        ? t("image.added", { count: status.ids.length, first: status.first })
        : status.kind === "empty"
          ? t("image.empty")
          : t(`image.error.${status.error}`);
  return (
    <div
      role="status"
      data-testid={TEST_IDS.imageImportStatus}
      className={`order-last flex basis-full flex-wrap items-center gap-2 text-sm ${status.kind === "error" ? "text-hi" : "text-muted"}`}
    >
      <span>{text}</span>
      {status.kind === "added" && (
        <button
          type="button"
          onClick={() => onUndo(status.ids)}
          disabled={disabled}
          data-testid={TEST_IDS.imageImportUndo}
          className="rounded-lg px-2 py-1 underline underline-offset-4 opacity-70 hover:opacity-100"
        >
          {t("image.undo")}
        </button>
      )}
    </div>
  );
}
