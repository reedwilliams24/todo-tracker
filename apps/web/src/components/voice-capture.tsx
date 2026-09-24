"use client";

import { useCallback, useRef, useState } from "react";
import type { Todo, TodoDraft } from "@todo/shared";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
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
};

type LastAdd = { ids: string[]; titles: string[]; source: ParseResult["source"] };

export function VoiceCapture({ todos, onAddMany, onUndo }: Props) {
  const [manualTranscript, setManualTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const [lastAdd, setLastAdd] = useState<LastAdd | null>(null);
  const [empty, setEmpty] = useState(false);
  const resetSpeechRef = useRef(() => {});

  const capture = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;
      setParsing(true);
      setEmpty(false);
      try {
        const parsed = await parseTodosFromTranscript(transcript, todos);
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

  const status = speech.listening
    ? "Listening… I'll add your todos once you stop talking."
    : parsing
      ? "Adding…"
      : null;

  return (
    <section
      aria-label="Voice capture"
      className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/15 dark:bg-white/5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleMic}
          disabled={!speech.supported || parsing}
          aria-pressed={speech.listening}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            speech.listening
              ? "bg-red-500 text-white"
              : "bg-foreground text-background disabled:opacity-40"
          }`}
        >
          {speech.listening ? "Stop and add" : "Speak your todos"}
        </button>

        {speech.listening && <span className="size-2 animate-pulse rounded-full bg-red-500" />}
        {status && <span className="text-sm opacity-70">{status}</span>}

        {!speech.listening && (speech.transcript || manualTranscript) && !parsing && (
          <button
            type="button"
            onClick={() => void capture(speech.transcript || manualTranscript)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          >
            Add these
          </button>
        )}
      </div>

      {!speech.supported && (
        <p className="text-xs opacity-70">
          This browser has no speech recognition, so type what you would say instead.
        </p>
      )}

      <textarea
        value={speech.listening || speech.transcript ? speech.transcript : manualTranscript}
        onChange={(event) => {
          speech.reset();
          setManualTranscript(event.target.value);
        }}
        readOnly={speech.listening}
        rows={2}
        placeholder="e.g. remind me to buy milk and then call the dentist tomorrow, also file taxes asap"
        aria-label="Transcript"
        className="w-full resize-y rounded-lg bg-transparent px-2 py-2 text-sm outline-none placeholder:opacity-50"
      />

      {speech.error && <p className="text-xs text-red-500">{speech.error}</p>}

      {empty && <p className="text-sm opacity-70">No tasks found in that transcript.</p>}

      {lastAdd && (
        <div className="flex flex-wrap items-center gap-2 border-t border-black/10 pt-3 text-sm dark:border-white/15">
          <span>
            Added {lastAdd.titles.length === 1 ? lastAdd.titles[0] : `${lastAdd.titles.length} todos`}{" "}
            <span className="opacity-70">({SOURCE_LABEL[lastAdd.source]})</span>
          </span>
          <button
            type="button"
            onClick={undo}
            className="rounded-lg px-2 py-1 underline underline-offset-4 opacity-70 hover:opacity-100"
          >
            Undo
          </button>
        </div>
      )}
    </section>
  );
}
