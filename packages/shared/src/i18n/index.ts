import { en, type MessageKey, type Messages } from "./en";

export { en, type MessageKey, type Messages };

export const DEFAULT_LOCALE = "en";

export const CATALOGS: Record<string, Messages> = { en };

export type MessageParams = Record<string, string | number>;

/**
 * Picks the first supported locale from a list of BCP 47 tags
 * (e.g. `navigator.languages`), matching on the language subtag.
 */
export function resolveLocale(
  preferred: readonly (string | null | undefined)[],
  supported: readonly string[] = Object.keys(CATALOGS),
): string {
  for (const tag of preferred) {
    if (!tag) continue;
    const lower = tag.toLowerCase();
    const exact = supported.find((s) => s.toLowerCase() === lower);
    if (exact) return exact;
    const lang = lower.split(/[-_]/)[0]!;
    const byLang = supported.find((s) => s.toLowerCase().split(/[-_]/)[0] === lang);
    if (byLang) return byLang;
  }
  return DEFAULT_LOCALE;
}

/** Splits `one {…} other {…}` into a map, honouring nested braces. */
function parseBranches(source: string): Map<string, string> {
  const options = new Map<string, string>();
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf("{", i);
    if (open === -1) break;
    const selector = source.slice(i, open).trim();
    let depth = 0;
    let close = open;
    for (; close < source.length; close++) {
      if (source[close] === "{") depth++;
      else if (source[close] === "}" && --depth === 0) break;
    }
    options.set(selector, source.slice(open + 1, close));
    i = close + 1;
  }
  return options;
}

function selectPlural(locale: string, count: number, branches: string): string {
  const options = parseBranches(branches);
  const exact = options.get(`=${count}`);
  if (exact !== undefined) return exact;
  const category = new Intl.PluralRules(locale).select(count);
  return options.get(category) ?? options.get("other") ?? "";
}

/** Finds `{name, plural, …}` blocks with balanced braces. */
function findPlural(message: string): { start: number; end: number; name: string; branches: string } | null {
  const match = /\{(\w+),\s*plural,/.exec(message);
  if (!match) return null;
  const start = match.index;
  let depth = 0;
  for (let i = start; i < message.length; i++) {
    if (message[i] === "{") depth++;
    else if (message[i] === "}" && --depth === 0) {
      return {
        start,
        end: i + 1,
        name: match[1]!,
        branches: message.slice(start + match[0].length, i),
      };
    }
  }
  return null;
}

/**
 * Formats a message with `{name}` interpolation and ICU-style
 * `{count, plural, one {...} other {...}}` selection (`#` = the number).
 */
export function formatMessage(
  locale: string,
  message: string,
  params: MessageParams = {},
): string {
  let out = message;
  for (let plural = findPlural(out); plural; plural = findPlural(out)) {
    const raw = params[plural.name];
    const count = typeof raw === "number" ? raw : Number(raw ?? 0);
    const branch = selectPlural(locale, count, plural.branches).replace(
      /#/g,
      new Intl.NumberFormat(locale).format(count),
    );
    out = out.slice(0, plural.start) + branch + out.slice(plural.end);
  }
  return out.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

export type Translator = (key: MessageKey, params?: MessageParams) => string;

export function createTranslator(locale: string): Translator {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE]!;
  return (key, params) => formatMessage(locale, catalog[key] ?? en[key], params);
}
