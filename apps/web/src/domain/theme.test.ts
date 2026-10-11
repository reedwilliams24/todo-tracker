import { describe, expect, it } from "vitest";
import { nextThemePreference, parseThemePreference, resolveTheme } from "./theme";

describe("theme", () => {
  it("parses stored preference with a system fallback", () => {
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("bogus")).toBe("system");
    expect(parseThemePreference(null)).toBe("system");
  });

  it("resolves system against the OS setting only", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("cycles light -> dark -> system", () => {
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
    expect(nextThemePreference("system")).toBe("light");
  });
});
