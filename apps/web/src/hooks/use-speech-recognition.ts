"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechState = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
};

export function useSpeechRecognition(lang = "en-US") {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const [state, setState] = useState<SpeechState>({
    supported: false,
    listening: false,
    transcript: "",
    error: null,
  });

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

    recognition.onresult = (event) => {
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
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

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
    recognitionRef.current?.stop();
    setState((current) => ({ ...current, listening: false }));
  }, []);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setState((current) => ({ ...current, transcript: "", error: null }));
  }, []);

  return { ...state, start, stop, reset };
}
