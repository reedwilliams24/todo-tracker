import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJson, SPEC_DIR } from "./paths";

/** Generates platform test-ID constants, message catalogs and Maestro flows from spec/. Run with --check in CI. */
const ids = readJson<Record<string, string>>(join(SPEC_DIR, "test-ids.json"));
const entries = Object.entries(ids).filter(([key]) => !key.startsWith("$"));
const HEADER = "Generated from spec/test-ids.json by `pnpm spec:generate`. Do not edit.";

function placeholders(pattern: string): string[] {
  return [...pattern.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
}

function tsEntry([key, pattern]: [string, string]): string {
  const params = placeholders(pattern);
  if (params.length === 0) return `  ${key}: ${JSON.stringify(pattern)},`;
  const body = pattern.replace(/\{(\w+)\}/g, "${$1}");
  return `  ${key}: (${params.map((p) => `${p}: string`).join(", ")}) => \`${body}\`,`;
}


type Step = Record<string, unknown> & { do?: string; expect?: string };
type Scenario = { name: string; platforms?: string[]; steps: Step[] };

function id(key: string, value = ""): string {
  const pattern = ids[key];
  if (!pattern) throw new Error(`Unknown test id "${key}"`);
  return pattern.replace(/\{\w+\}/, value);
}

const q = (value: unknown) => JSON.stringify(value);
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const tap = (testId: string) => [`- tapOn:`, `    id: ${q(testId)}`];
const visible = (testId: string, extra: string[] = []) => [`- assertVisible:`, `    id: ${q(testId)}`, ...extra];

/** Maestro commands for one scenario step; mirrors apps/web/e2e/scenarios.spec.ts. */
function maestroStep(step: Step): string[] {
  const s = step as Record<string, string> & {
    value?: boolean;
    titles?: string[];
    label?: string | null;
    title?: string | null;
  };
  switch (step.do) {
    case "type":
      return [...tap(id("formTitle")), `- inputText: ${q(s.text)}`];
    case "submit":
      return ["- hideKeyboard", ...tap(id("formSubmit"))];
    case "add":
      return [
        ...tap(id("formTitle")),
        `- inputText: ${q(s.title!)}`,
        ...(s.priority ? tap(id("formPriorityOption", s.priority)) : []),
        ...(s.dueDate ? [...tap(id("formDueDate")), `- inputText: ${q(s.dueDate)}`] : []),
        "- hideKeyboard",
        ...tap(id("formSubmit")),
        ...visible(id("item", s.title!)),
      ];
    case "toggle":
      return tap(id("itemToggle", s.title!));
    case "delete":
      return tap(id("itemDelete", s.title!));
    case "rename":
      return [
        ...tap(id("itemTitle", s.from)),
        "- eraseText: 200",
        `- inputText: ${q(s.to)}`,
        "- pressKey: Enter",
      ];
    case "filter":
      return tap(id("filter", s.filter));
    case "sort":
      return tap(id("sortOption", s.sort));
    case "search":
      return [...tap(id("search")), `- inputText: ${q(s.query)}`, "- hideKeyboard"];
    case "clearCompleted":
      return tap(id("clearCompleted"));
    case "undo":
      return tap(id("undoAction"));
    case "relaunch":
      return ["- runFlow: relaunch.yaml"];
    case "selectMode":
      return tap(id("selectMode"));
    case "select":
      return tap(id("itemSelect", s.title!));
    case "selectAll":
      return tap(id("selectAll"));
    case "bulkToggle":
      return tap(id("bulkToggle"));
    case "bulkDelete":
      return [...tap(id("bulkDelete")), ...tap(id(step.confirm ? "bulkDeleteConfirm" : "bulkDeleteCancel"))];
  }
  switch (step.expect) {
    case "empty":
      return visible(id("empty"));
    case "titles":
      return s.titles!.length === 0 ? visible(id("empty")) : s.titles!.flatMap((title) => visible(id("item", title)));
    case "remaining":
      return visible(id("remaining"), [`    text: ${q(s.text)}`]);
    case "completed":
      return visible(id("itemToggle", s.title!), [`    checked: ${s.value}`]);
    case "quickAddPreview":
      return s.title === null
        ? [`- assertNotVisible:`, `    id: ${q(id("quickAddPreview"))}`]
        : visible(id("quickAddPreviewTitle"), [`    text: ${q(s.title)}`]);
    case "priority":
      return visible(id("itemPriority", s.title!), [`    text: ${q(capitalize(s.priority!))}`]);
    case "dueDate":
      return visible(id("itemDueDate", s.title!), [`    text: ${q(s.dueDate)}`]);
    case "overdue":
      return step.value
        ? visible(id("itemOverdue", s.title!))
        : [`- assertNotVisible:`, `    id: ${q(id("itemOverdue", s.title!))}`];
    case "undo":
      return s.label === null
        ? [`- assertNotVisible:`, `    id: ${q(id("undoToast"))}`]
        : visible(id("undoLabel"), [`    text: ${q(s.label)}`]);
    case "selected":
      return visible(id("selectedCount"), [`    text: ${q(s.text)}`]);
    case "clearCompleted":
      return visible(id("clearCompleted"), [`    text: ${q(s.text)}`]);
  }
  throw new Error(`Unknown step ${JSON.stringify(step)}`);
}

function maestroFlows(): Record<string, string> {
  const { scenarios } = readJson<{ scenarios: Scenario[] }>(join(SPEC_DIR, "scenarios/core.json"));
  const flows: Record<string, string> = {};
  for (const scenario of scenarios) {
    if (scenario.platforms && !scenario.platforms.includes("mobile")) continue;
    const body = ["- runFlow: launch.yaml", ...scenario.steps.flatMap(maestroStep)];
    flows[`spec/scenarios/maestro/${scenario.name}.yaml`] =
      `# Generated from spec/scenarios/core.json by \`pnpm spec:generate\`. Do not edit.\nappId: \${APP_ID}\nname: ${scenario.name}\ntags:\n  - spec\n---\n${body.join("\n")}\n`;
  }
  return flows;
}

const messages = Object.entries(readJson<Record<string, string>>(join(SPEC_DIR, "i18n/en.json"))).filter(
  ([key]) => !key.startsWith("$"),
);
const I18N_HEADER = "Generated from spec/i18n/en.json by `pnpm spec:generate`. Do not edit.";
const kotlinString = (value: string) => q(value).replace(/\$/g, "\\$");

function catalogs(): Record<string, string> {
  return {
    "apps/web/src/domain/i18n/en.ts": `// ${I18N_HEADER}\n\nexport const en = {\n${messages
      .map(([key, value]) => `  ${q(key)}: ${q(value)},`)
      .join("\n")}\n} as const;\n\nexport type MessageKey = keyof typeof en;\nexport type Messages = Record<MessageKey, string>;\n`,
    "apps/android/core/src/main/kotlin/com/reedwilliams24/todotracker/core/Messages.kt": `// ${I18N_HEADER}\npackage com.reedwilliams24.todotracker.core\n\n/** English UI copy, keyed like spec/i18n/en.json. */\nval EN_MESSAGES: Map<String, String> = linkedMapOf(\n${messages
      .map(([key, value]) => `    ${q(key)} to ${kotlinString(value)},`)
      .join("\n")}\n)\n`,
    "apps/ios/TodoCore/Sources/TodoCore/Messages.swift": `// ${I18N_HEADER}\n\n/// English UI copy, keyed like spec/i18n/en.json.\npublic let enMessages: [String: String] = [\n${messages
      .map(([key, value]) => `    ${q(key)}: ${q(value)},`)
      .join("\n")}\n]\n`,
  };
}

const outputs: Record<string, string> = {
  "apps/web/src/domain/test-ids.ts": `// ${HEADER}\n\nexport const TEST_IDS = {\n${entries.map(tsEntry).join("\n")}\n} as const;\n`,
  ...catalogs(),
  ...maestroFlows(),
};

const check = process.argv.includes("--check");
let stale = 0;
for (const [relative, content] of Object.entries(outputs)) {
  const path = join(ROOT, relative);
  let current = "";
  try {
    current = readFileSync(path, "utf8");
  } catch {}
  if (current === content) continue;
  stale++;
  if (check) console.error(`stale: ${relative}`);
  else writeFileSync(path, content);
}
if (check && stale) {
  console.error("Generated files are out of date. Run `pnpm spec:generate`.");
  process.exit(1);
}
console.log(check ? "generated files up to date" : `wrote ${stale} file(s)`);
