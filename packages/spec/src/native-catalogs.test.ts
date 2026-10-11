import { en, formatMessage } from "web/domain";
import { describe, expect, it } from "vitest";
import { androidXml, form, toNative, xcstrings, type Catalog } from "./native-catalogs";

/** Minimal printf: what Android `getString` / iOS `String(format:)` do with these patterns. */
function printf(pattern: string, args: unknown[]): string {
  return pattern.replace(/%%|%(\d+)\$[sd]/g, (match, index?: string) => (match === "%%" ? "%" : String(args[Number(index) - 1])));
}

const catalog = Object.entries(en) as Catalog;

describe("native catalogs", () => {
  it.each(catalog)("%s renders like the web formatter", (key, pattern) => {
    const message = toNative(key, pattern);
    for (const count of [0, 1, 2, 5]) {
      const params = Object.fromEntries(message.args.map((a) => [a, a === message.plural ? count : `<${a}>`]));
      const native = form(message, message.plural && count === 1 ? "one" : "other");
      const rendered = message.args.length ? printf(native, message.args.map((a) => params[a])) : native;
      expect(rendered).toBe(formatMessage("en", pattern, params));
    }
  });

  it("escapes Android resource syntax", () => {
    expect(androidXml([["a.b", `It's "50%" & <b> `]])).toContain(
      `<string name="a_b" formatted="false">"It\\'s \\"50%\\" &amp; &lt;b> "</string>`,
    );
    expect(androidXml([["a.b", "50% of {n}"]])).toContain(`<string name="a_b">50%% of %1$s</string>`);
  });

  it("writes plurals for Android", () => {
    expect(androidXml([["list.remaining", en["list.remaining"]]])).toContain(
      `<item quantity="one">%1$d task remaining</item>\n        <item quantity="other">%1$d tasks remaining</item>`,
    );
  });

  it("writes String Catalog plural substitutions", () => {
    const entry = JSON.parse(xcstrings([["voice.added", en["voice.added"]]])).strings["voice.added"];
    expect(entry.localizations.en.stringUnit.value).toBe("Added %1$#@count@");
    expect(entry.localizations.en.substitutions.count).toEqual({
      argNum: 1,
      formatSpecifier: "lld",
      variations: {
        plural: {
          one: { stringUnit: { state: "translated", value: "%2$@" } },
          other: { stringUnit: { state: "translated", value: "%arg todos" } },
        },
      },
    });
  });

  it("rejects ICU the native formats can't express", () => {
    expect(() => toNative("k", "{count, plural, =0 {none} other {#}}")).toThrow(/=0/);
    expect(() => toNative("k", "{a, plural, one {x} other {y}} {b, plural, one {x} other {y}}")).toThrow(/one plural/);
    expect(() => androidXml([["a.b", "x"], ["a_b", "y"]])).toThrow(/same resource/);
  });
});
