import {
  cleanTitle,
  coerceDrafts,
  extractDueDate,
  extractPriority,
  parseTranscript,
  reconcileDrafts,
} from "web/domain";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "voice",
  spec: "features/voice.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    ...[
      "high priority call the bank",
      "pay rent urgent",
      "water plants low priority",
      "this is important email the landlord",
      "buy milk",
      "low key email bob",
    ].map((text) => ({ name: `extractPriority: ${text}`, op: "extractPriority", given: { text } })),
    // Monday 2026-01-05, local time.
    ...[
      "call mom today",
      "finish report tonight",
      "dentist tomorrow",
      "plan trip next week",
      "gym on friday",
      "standup monday",
      "meet sam next monday",
      "renew passport",
    ].map((text) => ({
      name: `extractDueDate: ${text}`,
      op: "extractDueDate",
      given: { text, now: "2026-01-05T09:00:00" },
    })),
    ...["um I need to buy milk.", "  remind me to call the bank  ", "Please, uh, water the plants!", "add a todo to pay rent"].map(
      (text) => ({ name: `cleanTitle: ${text.trim()}`, op: "cleanTitle", given: { text } }),
    ),
    ...[
      "buy milk and call mom tomorrow, then high priority pay rent",
      "I need to email Bob. Also water plants on friday",
      "um",
      "",
    ].map((transcript) => ({
      name: `parseTranscript: ${transcript || "(empty)"}`,
      op: "parseTranscript",
      given: { transcript, now: "2026-01-05T09:00:00" },
    })),
    {
      name: "coerceDrafts accepts model output and drops junk",
      op: "coerceDrafts",
      given: {
        value: {
          todos: [
            { title: " Buy milk ", priority: "HIGH", dueDate: "2026-01-06" },
            { title: "", priority: "low" },
            { title: "Call mom", priority: "urgent", dueDate: "next week" },
            "nope",
          ],
        },
      },
    },
    { name: "coerceDrafts accepts a bare array", op: "coerceDrafts", given: { value: [{ title: "Read" }] } },
    { name: "coerceDrafts rejects non-objects", op: "coerceDrafts", given: { value: "buy milk" } },
    {
      name: "reconcileDrafts replaces a heuristic draft with the matching llm draft",
      op: "reconcileDrafts",
      given: {
        heuristic: [{ title: "buy milk", priority: "high", dueDate: "2026-01-06" }],
        llm: [{ title: "Buy milk" }],
      },
    },
    { name: "reconcileDrafts falls back to heuristic", op: "reconcileDrafts", given: { heuristic: [{ title: "buy milk" }], llm: [] } },
  ],
};

export const ops: Ops = {
  parseTranscript: (g) => parseTranscript(g.transcript, new Date(g.now)),
  extractPriority: (g) => extractPriority(g.text),
  extractDueDate: (g) => extractDueDate(g.text, new Date(g.now)),
  cleanTitle: (g) => cleanTitle(g.text),
  coerceDrafts: (g) => coerceDrafts(g.value),
  reconcileDrafts: (g) => reconcileDrafts(g.heuristic, g.llm),
};
