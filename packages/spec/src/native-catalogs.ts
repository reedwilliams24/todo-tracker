/**
 * Converts spec/i18n/en.json into the platforms' own resource formats: Android `res/values`
 * (`<string>` / `<plurals>`) and an iOS String Catalog (`.xcstrings`), plus small key tables
 * so the apps can look messages up by spec key. Formatting, plural selection and locale
 * resolution are then done by the OS. See spec/features/localization.md.
 */

export type Catalog = [key: string, pattern: string][];

/** One message as printf-style parts: `%N$s` for text arguments, `%N$d` for the plural count. */
export type NativeMessage = {
  key: string;
  /** Argument names in positional order (`%1$…` is `args[0]`). */
  args: string[];
  /** Name of the argument that selects the plural form, if any. */
  plural?: string;
  prefix: string;
  suffix: string;
  /** Plural branches (English: `one`, `other`); empty for a non-plural message. */
  branches: { one: string; other: string };
};

const PLURAL = /\{(\w+),\s*plural,/g;
const PARAM = /\{(\w+)\}/g;

function parseBranches(key: string, source: string): { one: string; other: string } {
  const options: Record<string, string> = {};
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf("{", i);
    if (open === -1) {
      if (source.slice(i).trim()) throw new Error(`${key}: unexpected "${source.slice(i).trim()}" in plural`);
      break;
    }
    const selector = source.slice(i, open).trim();
    let depth = 0;
    let close = open;
    for (; close < source.length; close++) {
      if (source[close] === "{") depth++;
      else if (source[close] === "}" && --depth === 0) break;
    }
    if (selector !== "one" && selector !== "other") {
      throw new Error(`${key}: plural branch "${selector}" has no native equivalent; use only "one" and "other"`);
    }
    options[selector] ??= source.slice(open + 1, close);
    i = close + 1;
  }
  if (options.other === undefined) throw new Error(`${key}: plural needs an "other" branch`);
  return { one: options.one ?? options.other, other: options.other };
}

/** Splits a catalog pattern into printf parts; throws on ICU features Android/iOS resources can't express. */
export function toNative(key: string, pattern: string): NativeMessage {
  const plurals = [...pattern.matchAll(PLURAL)];
  if (plurals.length > 1) throw new Error(`${key}: only one plural per message is supported natively`);
  let prefix = pattern;
  let suffix = "";
  let branches: { one: string; other: string } | undefined;
  let plural: string | undefined;
  if (plurals.length === 1) {
    const match = plurals[0]!;
    plural = match[1]!;
    const start = match.index!;
    let depth = 0;
    let end = -1;
    for (let i = start; i < pattern.length; i++) {
      if (pattern[i] === "{") depth++;
      else if (pattern[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) throw new Error(`${key}: unclosed plural`);
    prefix = pattern.slice(0, start);
    suffix = pattern.slice(end + 1);
    branches = parseBranches(key, pattern.slice(start + match[0].length, end));
  }

  const args: string[] = [];
  const collect = (text: string) => {
    for (const [, name] of text.matchAll(PARAM)) if (!args.includes(name!)) args.push(name!);
  };
  collect(prefix);
  if (plural) {
    if (!args.includes(plural)) args.push(plural);
    collect(branches!.one);
    collect(branches!.other);
  }
  collect(suffix);

  const escape = args.length > 0;
  const printf = (text: string, inBranch: boolean) => {
    let out = escape ? text.replace(/%/g, "%%") : text;
    out = out.replace(PARAM, (_, name: string) => `%${args.indexOf(name) + 1}$${name === plural ? "d" : "s"}`);
    return inBranch && plural ? out.replace(/#/g, `%${args.indexOf(plural) + 1}$d`) : out;
  };
  return {
    key,
    args,
    plural,
    prefix: printf(prefix, false),
    suffix: printf(suffix, false),
    branches: branches
      ? { one: printf(branches.one, true), other: printf(branches.other, true) }
      : { one: "", other: "" },
  };
}

/** The full printf pattern for a plural form (the whole message when it has no plural). */
export function form(message: NativeMessage, quantity: "one" | "other"): string {
  return message.plural ? message.prefix + message.branches[quantity] + message.suffix : message.prefix;
}

export function resourceName(key: string): string {
  const name = key.replace(/\./g, "_");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`${key}: not usable as an Android resource name`);
  return name;
}

function androidText(text: string): string {
  let out = text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
  if (/^[@?]/.test(out)) out = `\\${out}`;
  return /^\s|\s$|\s\s/.test(text) ? `"${out}"` : out;
}

/** `res/values/messages.xml`: one `<string>` or `<plurals>` per catalog key. */
export function androidXml(catalog: Catalog, header = ""): string {
  const names = new Map<string, string>();
  const lines = catalog.map(([key, pattern]) => {
    const name = resourceName(key);
    if (names.has(name)) throw new Error(`${key} and ${names.get(name)} map to the same resource "${name}"`);
    names.set(name, key);
    const message = toNative(key, pattern);
    if (!message.plural) {
      const formatted = message.args.length === 0 && pattern.includes("%") ? ' formatted="false"' : "";
      return `    <string name="${name}"${formatted}>${androidText(message.prefix)}</string>`;
    }
    return [
      `    <plurals name="${name}">`,
      `        <item quantity="one">${androidText(form(message, "one"))}</item>`,
      `        <item quantity="other">${androidText(form(message, "other"))}</item>`,
      `    </plurals>`,
    ].join("\n");
  });
  const comment = header ? `<!-- ${header} -->\n` : "";
  return `<?xml version="1.0" encoding="utf-8"?>\n${comment}<resources>\n${lines.join("\n")}\n</resources>\n`;
}

/** Kotlin table from spec key to resource id and argument order (see ui/Translator.kt). */
export function androidTable(catalog: Catalog, namespace: string, packageName: string, header = ""): string {
  const rows = catalog.map(([key, pattern]) => {
    const message = toNative(key, pattern);
    const kind = message.plural ? "plurals" : "string";
    const extra = [
      ...(message.args.length ? [`listOf(${message.args.map((a) => JSON.stringify(a)).join(", ")})`] : []),
      ...(message.plural ? [`plural = ${JSON.stringify(message.plural)}`] : []),
    ];
    return `    ${JSON.stringify(key)} to Message(R.${kind}.${resourceName(key)}${extra.map((e) => `, ${e}`).join("")}),`;
  });
  const comment = header ? `// ${header}\n` : "";
  return `${comment}package ${packageName}\n\nimport ${namespace}.R\n\n/** Resource and format-argument order for each spec/i18n/en.json key. */\ninternal val MESSAGES: Map<String, Message> = mapOf(\n${rows.join("\n")}\n)\n`;
}

function iosText(text: string, message: NativeMessage, inBranch: boolean): string {
  const pluralIndex = message.plural ? message.args.indexOf(message.plural) + 1 : 0;
  return text.replace(/%(\d+)\$([sd])/g, (_, index: string, type: string) => {
    if (type === "s") return `%${index}$@`;
    return inBranch && Number(index) === pluralIndex ? "%arg" : `%${index}$lld`;
  });
}

const unit = (value: string) => ({ stringUnit: { state: "translated", value } });

/** Xcode's own String Catalog layout: sorted keys, `" : "` separators. */
function xcodeJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, child]) => [k, sort(child)]),
          )
        : v;
  return `${JSON.stringify(sort(value), null, 2).replace(/^(\s*"(?:[^"\\]|\\.)*"): /gm, "$1 : ")}\n`;
}

/** `Localizable.xcstrings`: plurals become a `%N$#@name@` substitution with `one`/`other` variations. */
export function xcstrings(catalog: Catalog): string {
  const strings: Record<string, unknown> = {};
  for (const [key, pattern] of catalog) {
    const message = toNative(key, pattern);
    let en: Record<string, unknown>;
    if (!message.plural) {
      en = unit(iosText(message.prefix, message, false));
    } else {
      const index = message.args.indexOf(message.plural) + 1;
      en = {
        ...unit(`${iosText(message.prefix, message, false)}%${index}$#@${message.plural}@${iosText(message.suffix, message, false)}`),
        substitutions: {
          [message.plural]: {
            argNum: index,
            formatSpecifier: "lld",
            variations: {
              plural: {
                one: unit(iosText(message.branches.one, message, true)),
                other: unit(iosText(message.branches.other, message, true)),
              },
            },
          },
        },
      };
    }
    strings[key] = { extractionState: "manual", localizations: { en } };
  }
  return xcodeJson({ sourceLanguage: "en", strings, version: "1.0" });
}

/** Swift table of format-argument order for keys that take arguments (see L10n.swift). */
export function swiftTable(catalog: Catalog, header = ""): string {
  const rows = catalog
    .map(([key, pattern]) => toNative(key, pattern))
    .filter((message) => message.args.length > 0)
    .map((message) => {
      const plural = message.plural ? `, plural: ${JSON.stringify(message.plural)}` : "";
      return `    ${JSON.stringify(message.key)}: MessageArgs([${message.args.map((a) => JSON.stringify(a)).join(", ")}]${plural}),`;
    });
  const comment = header ? `// ${header}\n\n` : "";
  return `${comment}/// Format-argument order for each Localizable.xcstrings key that takes arguments.\nlet messageArgs: [String: MessageArgs] = [\n${rows.join("\n")}\n]\n`;
}
