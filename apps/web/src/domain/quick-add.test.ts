import { describe, expect, it } from "vitest";
import { hasQuickAddMeta, parseQuickAdd, quickAddToDraft } from "./quick-add";

const now = new Date(2026, 8, 24, 10); // Thu 2026-09-24 local

describe("parseQuickAdd", () => {
  it("extracts tags, bang priority and relative dates", () => {
    expect(parseQuickAdd("call mom tomorrow 5pm #family !p1", now)).toEqual({
      title: "call mom 5pm",
      priority: "high",
      dueDate: "2026-09-25",
      tags: ["family"],
    });
  });

  it("supports !high/!med/!low and dedupes tags case-insensitively", () => {
    expect(parseQuickAdd("file taxes !low #Money #money", now)).toMatchObject({
      title: "file taxes",
      priority: "low",
      tags: ["money"],
    });
    expect(parseQuickAdd("x !med", now).priority).toBe("medium");
  });

  it("falls back to spoken priority words", () => {
    expect(parseQuickAdd("pay rent asap", now).priority).toBe("high");
  });

  it("parses weekdays, next week, in N days and ISO dates", () => {
    expect(parseQuickAdd("gym friday", now).dueDate).toBe("2026-09-25");
    expect(parseQuickAdd("gym thursday", now).dueDate).toBe("2026-10-01");
    expect(parseQuickAdd("review next week", now).dueDate).toBe("2026-10-01");
    expect(parseQuickAdd("renew passport in 10 days", now).dueDate).toBe("2026-10-04");
    expect(parseQuickAdd("dentist on 2026-12-01", now)).toMatchObject({
      title: "dentist",
      dueDate: "2026-12-01",
    });
  });

  it("does not treat # inside words or URLs as tags", () => {
    expect(parseQuickAdd("read issue#31 and page#2", now)).toEqual({
      title: "read issue#31 and page#2",
      priority: undefined,
      dueDate: undefined,
      tags: [],
    });
  });

  it("strips leading filler like voice parsing does", () => {
    expect(parseQuickAdd("remind me to buy milk today", now)).toMatchObject({
      title: "buy milk",
      dueDate: "2026-09-24",
    });
  });

  it("reports whether there is anything to preview", () => {
    expect(hasQuickAddMeta(parseQuickAdd("plain text", now))).toBe(false);
    expect(hasQuickAddMeta(parseQuickAdd("plain text #tag", now))).toBe(true);
  });

  it("converts to a draft using form fallbacks only when unset", () => {
    expect(quickAddToDraft(parseQuickAdd("a !p3", now), "medium", "2026-01-01")).toEqual({
      title: "a",
      priority: "low",
      dueDate: "2026-01-01",
    });
    expect(quickAddToDraft(parseQuickAdd("a", now), "high", "")).toEqual({
      title: "a",
      priority: "high",
      dueDate: undefined,
    });
  });
});
