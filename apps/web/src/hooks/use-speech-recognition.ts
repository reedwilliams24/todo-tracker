"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  lang?: string;
  /** Stop listening after this much silence; the final transcript is passed to `onSilence`. */
  silenceMs?: number;
  onSilence?: (transcript: string) => void;
};

type SpeechState = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
};

export function useSpeechRecognition({
  lang = "en-US",
  silenceMs = 5000,
  onSilence,
}: Options = {}) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;
  const [state, setState] = useState<SpeechState>({
    supported: false,
    listening: false,
    transcript: "",
    error: null,
  });

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setState((current) => ({ ...current, supported: false }));
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    const armSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        recognition.stop();
        setState((current) => ({ ...current, listening: false }));
        const spoken = finalTranscriptRef.current.trim();
        if (spoken) onSilenceRef.current?.(spoken);
      }, silenceMs);
    };

    recognition.onspeechstart = armSilenceTimer;

    recognition.onresult = (event) => {
      armSilenceTimer();
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${text}`.trim();
        } else {
          interim += text;
        }
      }
      setState((current) => ({
        ...current,
        transcript: `${finalTranscriptRef.current} ${interim}`.trim(),
      }));
    };

    recognition.onerror = (event) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setState((current) => ({
        ...current,
        listening: false,
        error:
          event.error === "not-allowed"
            ? "Microphone permission denied."
            : event.error === "no-speech"
              ? "No speech detected."
              : `Speech recognition error: ${event.error}`,
      }));
    };

    recognition.onend = () => {
      setState((current) => ({ ...current, listening: false }));
    };

    recognitionRef.current = recognition;
    setState((current) => ({ ...current, supported: true }));

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onspeechstart = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang, silenceMs]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    finalTranscriptRef.current = "";
    setState((current) => ({ ...current, transcript: "", error: null, listening: true }));
    try {
      recognition.start();
    } catch {
      // start() throws if called while already listening; state is already correct
    }
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
    setState((current) => ({ ...current, listening: false }));
  }, [clearSilenceTimer]);

  const reset = useCallback(() => {
    clearSilenceTimer();
    finalTranscriptRef.current = "";
    setState((current) => ({ ...current, transcript: "", error: null }));
  }, [clearSilenceTimer]);

  return { ...state, start, stop, reset };
}
