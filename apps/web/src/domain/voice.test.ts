import { describe, expect, it } from "vitest";
import {
  cleanTitle,
  coerceDrafts,
  extractDueDate,
  extractPriority,
  parseTranscript,
  reconcileDrafts,
} from "./voice";

const monday = new Date("2024-05-06T12:00:00.000Z");

describe("cleanTitle", () => {
  it("strips spoken filler and trailing punctuation", () => {
    expect(cleanTitle("um remind me to buy milk.")).toBe("buy milk");
    expect(cleanTitle("add a todo to call mom")).toBe("call mom");
  });
});

describe("extractPriority", () => {
  it("detects urgency words and removes them", () => {
    const { priority, rest } = extractPriority("file taxes asap");
    expect(priority).toBe("high");
    expect(rest).not.toMatch(/asap/);
  });

  it("returns no priority when unspecified", () => {
    expect(extractPriority("water plants").priority).toBeUndefined();
  });
});

describe("extractDueDate", () => {
  it("resolves relative days", () => {
    expect(extractDueDate("pay rent tomorrow", monday).dueDate).toBe("2024-05-07");
    expect(extractDueDate("pay rent today", monday).dueDate).toBe("2024-05-06");
  });

  it("resolves the next occurrence of a weekday", () => {
    expect(extractDueDate("gym on friday", monday).dueDate).toBe("2024-05-10");
  });
});

describe("parseTranscript", () => {
  it("splits multiple spoken todos", () => {
    const drafts = parseTranscript(
      "remind me to buy milk and then call the dentist tomorrow, and also file taxes asap",
      monday,
    );
    expect(drafts).toEqual([
      { title: "buy milk", priority: undefined, dueDate: undefined },
      { title: "call the dentist", priority: undefined, dueDate: "2024-05-07" },
      { title: "file taxes", priority: "high", dueDate: undefined },
    ]);
  });

  it("drops empty segments", () => {
    expect(parseTranscript("um, and then , uh", monday)).toEqual([]);
    expect(parseTranscript("um, uh, and then", monday)).toEqual([]);
  });
});

describe("reconcileDrafts", () => {
  it("recovers tasks the model dropped, keeping model wording and metadata", () => {
    const heuristic = [{ title: "buy milk" }, { title: "call the dentist" }, { title: "file my taxes" }];
    const llm = [
      { title: "Buy milk", priority: "low" as const },
      { title: "Call the dentist", priority: "high" as const, dueDate: "2024-05-07" },
    ];

    expect(reconcileDrafts(heuristic, llm)).toEqual([
      { title: "Buy milk", priority: "low" },
      { title: "Call the dentist", priority: "high", dueDate: "2024-05-07" },
      { title: "file my taxes" },
    ]);
  });

  it("keeps model-only tasks and does not duplicate matched ones", () => {
    const merged = reconcileDrafts(
      [{ title: "water the plants and feed the cat" }],
      [{ title: "Water the plants" }, { title: "Feed the cat" }],
    );
    expect(merged).toEqual([{ title: "Water the plants" }, { title: "Feed the cat" }]);
  });

  it("falls back to the heuristic drafts when the model returned nothing", () => {
    expect(reconcileDrafts([{ title: "buy milk" }], [])).toEqual([{ title: "buy milk" }]);
  });
});

describe("coerceDrafts", () => {
  it("accepts a bare array and a wrapped object", () => {
    expect(coerceDrafts([{ title: "a" }])).toHaveLength(1);
    expect(coerceDrafts({ todos: ["b"] })).toEqual([{ title: "b", priority: undefined, dueDate: undefined }]);
  });

  it("drops malformed entries and invalid fields", () => {
    const drafts = coerceDrafts([
      { title: "  " },
      { title: 42 },
      null,
      { title: "ship it", priority: "urgent", dueDate: "next friday" },
    ]);
    expect(drafts).toEqual([{ title: "ship it", priority: undefined, dueDate: undefined }]);
  });

  it("returns nothing for non-list input", () => {
    expect(coerceDrafts("nope")).toEqual([]);
  });
});
