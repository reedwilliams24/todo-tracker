"use client";

import { useState } from "react";
import type { TodoDraft } from "@todo/shared";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { parseTodosFromTranscript, type ParseResult } from "@/lib/parse-todos";

const SOURCE_LABEL: Record<ParseResult["source"], string> = {
  llm: "parsed by the local model",
  heuristic: "parsed without the model",
  offline: "parsed in your browser",
};

export function VoiceCapture({ onAdd }: { onAdd: (draft: TodoDraft) => void }) {
  const speech = useSpeechRecognition();
  const [manualTranscript, setManualTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [drafts, setDrafts] = useState<TodoDraft[]>([]);

  const transcript = speech.listening || speech.transcript ? speech.transcript : manualTranscript;
  const canParse = transcript.trim().length > 0 && !parsing;

  async function handleParse() {
    setParsing(true);
    try {
      const parsed = await parseTodosFromTranscript(transcript);
      setResult(parsed);
      setDrafts(parsed.todos);
    } finally {
      setParsing(false);
    }
  }

  function handleConfirm() {
    drafts.forEach(onAdd);
    discard();
  }

  function discard() {
    setDrafts([]);
    setResult(null);
    setManualTranscript("");
    speech.reset();
  }

  return (
    <section
      aria-label="Voice capture"
      className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/15 dark:bg-white/5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={speech.listening ? speech.stop : speech.start}
          disabled={!speech.supported}
          aria-pressed={speech.listening}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            speech.listening
              ? "bg-red-500 text-white"
              : "bg-foreground text-background disabled:opacity-40"
          }`}
        >
          {speech.listening ? "Stop listening" : "Speak your todos"}
        </button>

        {speech.listening && (
          <span className="flex items-center gap-2 text-sm opacity-70">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            Listening…
          </span>
        )}

        <button
          type="button"
          onClick={handleParse}
          disabled={!canParse}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm disabled:opacity-40 dark:border-white/20"
        >
          {parsing ? "Parsing…" : "Turn into todos"}
        </button>
      </div>

      {!speech.supported && (
        <p className="text-xs opacity-70">
          This browser has no speech recognition, so type what you would say instead.
        </p>
      )}

      <textarea
        value={transcript}
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

      {result && (
        <div className="flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/15">
          {drafts.length === 0 ? (
            <p className="text-sm opacity-70">No tasks found in that transcript.</p>
          ) : (
            <>
              <p className="text-xs opacity-60">
                {drafts.length} suggested {drafts.length === 1 ? "todo" : "todos"} ({SOURCE_LABEL[result.source]})
              </p>
              <ul className="flex flex-col gap-2">
                {drafts.map((draft, index) => (
                  <li key={`${draft.title}-${index}`} className="flex items-center gap-2">
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        setDrafts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item,
                          ),
                        )
                      }
                      aria-label={`Suggested todo ${index + 1}`}
                      className="flex-1 rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/15"
                    />
                    {draft.dueDate && <span className="text-xs opacity-60">{draft.dueDate}</span>}
                    {draft.priority && (
                      <span className="text-xs capitalize opacity-60">{draft.priority}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Discard suggestion "${draft.title}"`}
                      className="px-1 text-sm opacity-50 hover:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={drafts.length === 0 || drafts.some((draft) => draft.title.trim().length === 0)}
              className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
            >
              Add {drafts.length > 0 ? drafts.length : ""} {drafts.length === 1 ? "todo" : "todos"}
            </button>
            <button
              type="button"
              onClick={discard}
              className="rounded-lg px-3 py-1.5 text-sm opacity-70 hover:opacity-100"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
