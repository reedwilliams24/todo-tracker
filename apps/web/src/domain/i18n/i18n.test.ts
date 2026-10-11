import { describe, expect, it } from "vitest";
import { createTranslator, en, formatMessage, resolveLocale } from "./index";

describe("resolveLocale", () => {
  it("matches language subtags and falls back to English", () => {
    expect(resolveLocale(["en-US"])).toBe("en");
    expect(resolveLocale(["fr-CA", "en-GB"])).toBe("en");
    expect(resolveLocale(["fr"])).toBe("en");
    expect(resolveLocale([null, undefined, ""])).toBe("en");
    expect(resolveLocale(["de-DE"], ["en", "de"])).toBe("de");
    expect(resolveLocale(["pt-BR"], ["en", "pt-BR", "pt"])).toBe("pt-BR");
  });
});

describe("formatMessage", () => {
  it("interpolates named params and leaves unknown ones", () => {
    expect(formatMessage("en", "Hi {name}", { name: "Ada" })).toBe("Hi Ada");
    expect(formatMessage("en", "Hi {name}")).toBe("Hi {name}");
  });

  it("selects plural branches with # substitution", () => {
    const msg = "{count, plural, one {# task remaining} other {# tasks remaining}}";
    expect(formatMessage("en", msg, { count: 1 })).toBe("1 task remaining");
    expect(formatMessage("en", msg, { count: 0 })).toBe("0 tasks remaining");
    expect(formatMessage("en", msg, { count: 1000 })).toBe("1,000 tasks remaining");
  });

  it("supports exact matches and nested params inside branches", () => {
    const msg = "{count, plural, =0 {none} one {{first}} other {# todos}}";
    expect(formatMessage("en", msg, { count: 0 })).toBe("none");
    expect(formatMessage("en", msg, { count: 1, first: "Buy milk" })).toBe("Buy milk");
    expect(formatMessage("en", msg, { count: 3 })).toBe("3 todos");
  });
});

describe("createTranslator", () => {
  it("translates catalog keys and falls back to English for unknown locales", () => {
    const t = createTranslator("xx");
    expect(t("form.add")).toBe(en["form.add"]);
    expect(t("list.remaining", { count: 2 })).toBe("2 tasks remaining");
    expect(t("item.delete", { title: "Milk" })).toBe('Delete "Milk"');
  });

  it("has no empty messages", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.length, key).toBeGreaterThan(0);
    }
  });
});
