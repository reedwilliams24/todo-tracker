import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJson, SPEC_DIR } from "./paths";

/** Generates platform test-ID constants from spec/test-ids.json. Run with --check in CI. */
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
const tap = (testId: string) => [`- tapOn:`, `    id: ${q(testId)}`];
const visible = (testId: string, extra: string[] = []) => [`- assertVisible:`, `    id: ${q(testId)}`, ...extra];

/** Maestro commands for one scenario step; mirrors apps/web/e2e/scenarios.spec.ts. */
function maestroStep(step: Step): string[] {
  const s = step as Record<string, string> & { value?: boolean; titles?: string[]; label?: string | null };
  switch (step.do) {
    case "add":
      return [
        ...tap(id("formTitle")),
        `- inputText: ${q(s.title)}`,
        ...(s.priority ? tap(id("formPriorityOption", s.priority)) : []),
        ...(s.dueDate ? [...tap(id("formDueDate")), `- inputText: ${q(s.dueDate)}`] : []),
        "- hideKeyboard",
        ...tap(id("formSubmit")),
        ...visible(id("item", s.title)),
      ];
    case "toggle":
      return tap(id("itemToggle", s.title));
    case "delete":
      return tap(id("itemDelete", s.title));
    case "rename":
      return [
        ...tap(id("itemTitle", s.from)),
        "- eraseText: 200",
        `- inputText: ${q(s.to)}`,
        "- pressKey: Enter",
      ];
    case "filter":
      return tap(id("filter", s.filter));
    case "search":
      return [...tap(id("search")), `- inputText: ${q(s.query)}`, "- hideKeyboard"];
    case "clearCompleted":
      return tap(id("clearCompleted"));
    case "undo":
      return tap(id("undoAction"));
    case "relaunch":
      return ["- runFlow: relaunch.yaml"];
  }
  switch (step.expect) {
    case "empty":
      return visible(id("empty"));
    case "titles":
      return s.titles!.length === 0 ? visible(id("empty")) : s.titles!.flatMap((title) => visible(id("item", title)));
    case "remaining":
      return visible(id("remaining"), [`    text: ${q(s.text)}`]);
    case "completed":
      return visible(id("itemToggle", s.title), [`    checked: ${s.value}`]);
    case "undo":
      return s.label === null
        ? [`- assertNotVisible:`, `    id: ${q(id("undoToast"))}`]
        : visible(id("undoLabel"), [`    text: ${q(s.label)}`]);
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

const outputs: Record<string, string> = {
  "packages/shared/src/test-ids.ts": `// ${HEADER}\n\nexport const TEST_IDS = {\n${entries.map(tsEntry).join("\n")}\n} as const;\n`,
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
  console.error("Generated test IDs are out of date. Run `pnpm spec:generate`.");
  process.exit(1);
}
console.log(check ? "generated files up to date" : `wrote ${stale} file(s)`);
