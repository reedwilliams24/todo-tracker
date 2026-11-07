"use client";

import { MicIcon } from "@/components/daybook-icons";
import { useCallback, useRef, useState } from "react";
import type { Todo, TodoDraft } from "@/domain";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useT } from "@/hooks/use-t";
import { parseTodosFromTranscript, type ParseResult } from "@/lib/parse-todos";

const SOURCE_LABEL: Record<ParseResult["source"], string> = {
  llm: "sorted by the local model",
  heuristic: "added without the model",
  offline: "added offline",
};

type Props = {
  todos: readonly Todo[];
  onAddMany: (drafts: TodoDraft[]) => Todo[];
  onUndo: (ids: string[]) => void;
  /** Read-only list (spec/features/realtime.md#connection-status). */
  disabled?: boolean;
  describedBy?: string;
};

type LastAdd = { ids: string[]; titles: string[]; source: ParseResult["source"] };

export function VoiceCapture({ todos, onAddMany, onUndo, disabled = false, describedBy }: Props) {
  const t = useT();
  const [manualTranscript, setManualTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const [lastAdd, setLastAdd] = useState<LastAdd | null>(null);
  const [empty, setEmpty] = useState(false);
  const resetSpeechRef = useRef(() => {});
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const capture = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;
      setParsing(true);
      setEmpty(false);
      try {
        const parsed = await parseTodosFromTranscript(transcript, todos);
        if (disabledRef.current) return;
        if (parsed.todos.length === 0) {
          setLastAdd(null);
          setEmpty(true);
          return;
        }
        const added = onAddMany(parsed.todos);
        setLastAdd({
          ids: added.map((todo) => todo.id),
          titles: added.map((todo) => todo.title),
          source: parsed.source,
        });
        setManualTranscript("");
        resetSpeechRef.current();
      } finally {
        setParsing(false);
      }
    },
    [onAddMany, todos],
  );

  const speech = useSpeechRecognition({ onSilence: capture });
  resetSpeechRef.current = speech.reset;

  function handleMic() {
    if (speech.listening) {
      const spoken = speech.transcript;
      speech.stop();
      void capture(spoken);
      return;
    }
    setLastAdd(null);
    setEmpty(false);
    speech.start();
  }

  function undo() {
    if (!lastAdd) return;
    onUndo(lastAdd.ids);
    setLastAdd(null);
  }

  const status = speech.listening ? t("voice.listening") : parsing ? t("voice.adding") : null;

  return (
    <section aria-label={t("voice.label")} className="flex flex-col gap-2 border-t border-line px-3 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleMic}
          disabled={!speech.supported || parsing || (disabled && !speech.listening)}
          aria-describedby={disabled ? describedBy : undefined}
          aria-pressed={speech.listening}
          aria-label={speech.listening ? t("voice.stop") : t("voice.speak")}
          title={speech.listening ? t("voice.stop") : t("voice.speak")}
          className={`grid size-11 shrink-0 place-items-center rounded-full shadow-sm transition ${
            speech.listening ? "animate-pulse bg-hi text-white" : "bg-accent text-accent-ink disabled:opacity-40"
          }`}
        >
          <MicIcon width={20} height={20} />
        </button>
        <textarea
          value={speech.listening || speech.transcript ? speech.transcript : manualTranscript}
          onChange={(event) => {
            speech.reset();
            setManualTranscript(event.target.value);
          }}
          readOnly={speech.listening}
          rows={1}
          placeholder={t("voice.transcript.placeholder")}
          aria-label={t("voice.transcript")}
          className="min-h-9 flex-1 resize-y rounded-lg bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted"
        />

        {status && <span className="text-sm text-muted">{status}</span>}

        {!speech.listening && (speech.transcript || manualTranscript) && !parsing && (
          <button
            type="button"
            onClick={() => void capture(speech.transcript || manualTranscript)}
            disabled={disabled}
            aria-describedby={disabled ? describedBy : undefined}
            className="shrink-0 rounded-xl bg-soft px-3 py-2 text-sm font-semibold text-accent"
          >
            {t("voice.addThese")}
          </button>
        )}
      </div>

      {!speech.supported && <p className="text-xs text-muted">{t("voice.unsupported")}</p>}

      {speech.error && <p className="text-xs text-hi">{speech.error}</p>}

      {empty && <p className="text-sm text-muted">{t("voice.empty")}</p>}

      {lastAdd && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm">
          <span>
            {t("voice.added", { count: lastAdd.titles.length, first: lastAdd.titles[0] ?? "" })}{" "}
            <span className="opacity-70">({SOURCE_LABEL[lastAdd.source]})</span>
          </span>
          <button
            type="button"
            onClick={undo}
            disabled={disabled}
            className="rounded-lg px-2 py-1 underline underline-offset-4 opacity-70 hover:opacity-100"
          >
            {t("voice.undo")}
          </button>
        </div>
      )}
    </section>
  );
}
