"use client";

import { useRef, useState } from "react";
import {
  describeImport,
  describeImported,
  exportFileName,
  exportTodosCsv,
  exportTodosJson,
  parseImportJson,
  TEST_IDS,
  type ImportMode,
  type ImportResult,
  type Todo,
} from "@/domain";

type DataTransferProps = {
  todos: readonly Todo[];
  onImport: (todos: readonly Todo[], mode: ImportMode) => void;
};

function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function DataTransfer({ todos, onImport }: DataTransferProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    setPending(parseImportJson(await file.text()));
    if (fileRef.current) fileRef.current.value = "";
  }

  function finish(mode: ImportMode) {
    if (!pending) return;
    onImport(pending.todos, mode);
    setStatus(describeImported(pending.todos.length, mode));
    setPending(null);
  }

  const linkClass = "opacity-70 underline-offset-4 hover:underline hover:opacity-100 disabled:opacity-30";

  return (
    <div className="flex flex-col gap-2 text-xs" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid={TEST_IDS.exportJson}
          disabled={todos.length === 0}
          onClick={() => download(exportFileName("json"), exportTodosJson(todos), "application/json")}
          className={linkClass}
        >
          Export JSON
        </button>
        <button
          type="button"
          data-testid={TEST_IDS.exportCsv}
          disabled={todos.length === 0}
          onClick={() => download(exportFileName("csv"), exportTodosCsv(todos), "text/csv")}
          className={linkClass}
        >
          Export CSV
        </button>
        <button
          type="button"
          data-testid={TEST_IDS.importOpen}
          onClick={() => fileRef.current?.click()}
          className={linkClass}
        >
          Import JSON…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Import todos from JSON"
          data-testid={TEST_IDS.importFile}
          onChange={(event) => void onFile(event.target.files?.[0])}
          className="hidden"
        />
        {status && (
          <span data-testid={TEST_IDS.importStatus} className="opacity-60">
            {status}
          </span>
        )}
      </div>

      {pending && (
        <div
          role="dialog"
          aria-label="Confirm import"
          data-testid={TEST_IDS.importDialog}
          className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/15 dark:bg-white/5"
        >
          <p data-testid={TEST_IDS.importSummary}>{describeImport(pending.todos.length, pending.errors.length)}</p>
          {pending.errors.length > 0 && (
            <ul className="max-h-32 list-disc overflow-y-auto pl-4 text-red-700 dark:text-red-400">
              {pending.errors.map((error) => (
                <li key={error} data-testid={TEST_IDS.importError}>
                  {error}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              data-testid={TEST_IDS.importMode("merge")}
              disabled={pending.todos.length === 0}
              onClick={() => finish("merge")}
              className="rounded-lg bg-foreground px-3 py-1 text-background disabled:opacity-30"
            >
              Merge into current list
            </button>
            <button
              type="button"
              data-testid={TEST_IDS.importMode("replace")}
              disabled={pending.todos.length === 0}
              onClick={() => finish("replace")}
              className="rounded-lg border border-black/20 px-3 py-1 dark:border-white/30 disabled:opacity-30"
            >
              Replace current list
            </button>
            <button
              type="button"
              data-testid={TEST_IDS.importCancel}
              onClick={() => setPending(null)}
              className={linkClass}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
