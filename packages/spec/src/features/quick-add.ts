import { hasQuickAddMeta, parseQuickAdd, quickAddToDraft, type QuickAddParse, type TodoPriority } from "web/domain";
import type { Feature, Ops } from "../types";

export const feature: Feature = {
  feature: "quick-add",
  spec: "features/quick-add.md",
  status: { web: "pass", ios: "pass", android: "pass" },
  cases: [
    // Monday 2026-01-05, local time.
    ...[
      "call mom tomorrow 5pm #family !p1",
      "file taxes !low #Money #money",
      "x !med",
      "x !Medium",
      "x !p2",
      "x !P3",
      "x !p4",
      "pay rent asap",
      "email bob !urgent",
      "gym friday",
      "gym monday",
      "review next week",
      "renew passport in 10 days",
      "water plants in 1 day",
      "dentist on 2026-12-01",
      "rent due 2026-02-01 !high",
      "pay due 2026-02-30",
      "read issue#31 and page#2",
      "plan trip #café #2026 #road-trip",
      "remind me to buy milk today",
      "!p1 #tag",
      "plain text",
    ].map((input) => ({
      name: `parseQuickAdd: ${input}`,
      op: "parseQuickAdd",
      given: { input, now: "2026-01-05T09:00:00" },
    })),
    { name: "hasQuickAddMeta: plain", op: "hasQuickAddMeta", given: { parse: { title: "plain text", tags: [] } } },
    { name: "hasQuickAddMeta: tag only", op: "hasQuickAddMeta", given: { parse: { title: "plain", tags: ["tag"] } } },
    {
      name: "hasQuickAddMeta: priority only",
      op: "hasQuickAddMeta",
      given: { parse: { title: "x", priority: "low", tags: [] } },
    },
    {
      name: "quickAddToDraft prefers parsed values",
      op: "quickAddToDraft",
      given: {
        parse: { title: "call mom", priority: "high", dueDate: "2026-01-06", tags: ["family"] },
        fallbackPriority: "low",
        fallbackDueDate: "2026-02-01",
      },
    },
    {
      name: "quickAddToDraft falls back to the form controls",
      op: "quickAddToDraft",
      given: { parse: { title: "a", tags: [] }, fallbackPriority: "high", fallbackDueDate: "2026-02-01" },
    },
    {
      name: "quickAddToDraft treats an empty fallback date as none",
      op: "quickAddToDraft",
      given: { parse: { title: "a", priority: "low", tags: [] }, fallbackPriority: "medium", fallbackDueDate: "" },
    },
  ],
};

export const ops: Ops = {
  parseQuickAdd: (g) => parseQuickAdd(g.input, new Date(g.now)),
  hasQuickAddMeta: (g) => hasQuickAddMeta(g.parse as QuickAddParse),
  quickAddToDraft: (g) =>
    quickAddToDraft(g.parse as QuickAddParse, g.fallbackPriority as TodoPriority, g.fallbackDueDate),
};
