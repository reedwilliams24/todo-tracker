import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { androidTable, androidXml, swiftTable, xcstrings } from "./native-catalogs";
import { loadScenarios, ROOT, readJson, SPEC_DIR, toJson } from "./paths";

/** Generates platform test-ID constants, message catalogs and Maestro flows from spec/. Run with --check in CI. */
const ids = readJson<Record<string, string>>(join(SPEC_DIR, "test-ids.json"));
const entries = Object.entries(ids)
  .filter(([key]) => !key.startsWith("$"))
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
/** test-ids.json is kept in key order so selectors added by parallel PRs land in different places. */
const sortedIds = toJson({
  ...Object.fromEntries(Object.entries(ids).filter(([key]) => key.startsWith("$"))),
  ...Object.fromEntries(entries),
});
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

function id(key: string, value = ""): string {
  const pattern = ids[key];
  if (!pattern) throw new Error(`Unknown test id "${key}"`);
  return pattern.replace(/\{\w+\}/, value);
}

const q = (value: unknown) => JSON.stringify(value);
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const tap = (testId: string) => [`- tapOn:`, `    id: ${q(testId)}`];
const visible = (testId: string, extra: string[] = []) => [`- assertVisible:`, `    id: ${q(testId)}`, ...extra];
const hidden = (testId: string) => [`- assertNotVisible:`, `    id: ${q(testId)}`];
/** Maestro matches `text` as a full regex; escape everything but the `${…}` interpolations. */
const literal = (text: string) =>
  text
    .split(/(\$\{[^}]*\})/)
    .map((part, i) => (i % 2 ? part : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
/** A per-run unique address (`reed.<run>@example.com`) so GoTrue's 60 s resend limit and Mailpit searches never collide. */
const runEmail = (email: string) => email.replace("@", ".${output.run}@");

function requestCode(email: string): string[] {
  return [
    ...tap(id("authSignIn")),
    ...tap(id("authEmail")),
    `- inputText: ${q(runEmail(email))}`,
    "- hideKeyboard",
    ...tap(id("authSendCode")),
    ...visible(id("authCode")),
  ];
}

function enterCode(code: string, email: string): string[] {
  const emailed = code === "{emailed}";
  return [
    ...(emailed ? ["- runScript:", "    file: mailpit-code.js", "    env:", `      EMAIL: ${q(runEmail(email))}`] : []),
    ...tap(id("authCode")),
    "- eraseText: 10",
    `- inputText: ${q(emailed ? "${output.code}" : code)}`,
    // iOS's number pad has no dismiss key and the ticking resend countdown never lets Maestro's swipe-to-dismiss
    // settle; Verify sits above the keyboard there anyway.
    "- runFlow:",
    "    when:",
    "      platform: Android",
    "    commands:",
    "      - hideKeyboard",
    ...tap(id("authVerify")),
  ];
}

/** Maestro commands for one scenario step; mirrors apps/web/e2e/scenarios.spec.ts. */
function maestroStep(step: Step, ctx: { email?: string }): string[] {
  const s = step as Record<string, string> & {
    value?: boolean;
    titles?: string[];
    label?: string | null;
    title?: string | null;
  };
  switch (step.do) {
    case "add":
      return [
        ...tap(id("formTitle")),
        `- inputText: ${q(s.title!)}`,
        ...(s.priority ? tap(id("formPriorityOption", s.priority)) : []),
        ...(s.recurrence ? tap(id("formRecurrenceOption", s.recurrence)) : []),
        // Reminder options stay disabled until a due date is entered, so type the date first.
        ...(s.dueDate ? [...tap(id("formDueDate")), `- inputText: ${q(s.dueDate)}`] : []),
        ...(s.reminder ? tap(id("formReminderOption", s.reminder)) : []),
        "- hideKeyboard",
        ...tap(id("formSubmit")),
        ...visible(id("item", s.title!)),
      ];
    case "addSubtask":
      return [
        ...tap(id("subtaskInput", s.title!)),
        `- inputText: ${q(s.subtask)}`,
        "- pressKey: Enter",
        ...visible(id("subtask", s.subtask!)),
      ];
    case "bulkDelete":
      return [...tap(id("bulkDelete")), ...tap(id(step.confirm ? "bulkDeleteConfirm" : "bulkDeleteCancel"))];
    case "bulkToggle":
      return tap(id("bulkToggle"));
    case "cancelDeleteAccount":
      return [...tap(id("authDeleteCancel")), ...hidden(id("authDeleteConfirm"))];
    case "chooseGuestTodos":
      return tap(id(s.choice === "move" ? "authMoveConfirm" : "authMoveDiscard"));
    case "clearCompleted":
      return tap(id("clearCompleted"));
    case "confirmDeleteAccount":
      return [...tap(id("authDeleteConfirm")), ...hidden(id("authAccount"))];
    case "delete":
      return tap(id("itemDelete", s.title!));
    case "deleteSubtask":
      return tap(id("subtaskDelete", s.subtask!));
    case "enterCode":
      return enterCode(s.code!, ctx.email!);
    case "expandSubtasks":
      return tap(id("itemSubtasksToggle", s.title!));
    case "filter":
      return tap(id("filter", s.filter));
    case "forgetLocalTodos":
      // Debug builds drop the account cache and cursor (keeping the session) when launched with this argument.
      return [
        "- stopApp",
        "- launchApp:",
        "    clearState: false",
        "    arguments:",
        "      forgetLocalTodos: true",
        `- extendedWaitUntil:`,
        `    visible:`,
        `      id: ${q(id("formTitle"))}`,
        "    timeout: 60000",
      ];
    case "openDeleteAccount":
      return [...tap(id("authAccount")), ...tap(id("authDeleteAccount")), ...visible(id("authDeleteConfirm"))];
    case "openStats":
      return [`- scrollUntilVisible:`, `    element:`, `      id: ${q(id("statsToggle"))}`, ...tap(id("statsToggle"))];
    case "relaunch":
      return ["- runFlow: relaunch.yaml"];
    case "rename":
      return [...tap(id("itemTitle", s.from)), "- eraseText: 200", `- inputText: ${q(s.to)}`, "- pressKey: Enter"];
    case "requestCode":
      ctx.email = s.email!;
      return requestCode(s.email!);
    case "search":
      return [...tap(id("search")), `- inputText: ${q(s.query)}`, "- hideKeyboard"];
    case "select":
      return tap(id("itemSelect", s.title!));
    case "selectAll":
      return tap(id("selectAll"));
    case "selectMode":
      return tap(id("selectMode"));
    case "signIn":
      ctx.email = s.email!;
      return [...requestCode(s.email!), ...enterCode("{emailed}", s.email!)];
    case "signOut":
      return [...tap(id("authAccount")), ...tap(id("authSignOut")), ...hidden(id("authAccount"))];
    case "sort":
      return tap(id("sortOption", s.sort));
    case "submit":
      return ["- hideKeyboard", ...tap(id("formSubmit"))];
    case "theme":
      return tap(id("themeOption", s.theme));
    case "toggle":
      return tap(id("itemToggle", s.title!));
    case "toggleSubtask":
      return tap(id("subtaskToggle", s.subtask!));
    case "type":
      return [...tap(id("formTitle")), `- inputText: ${q(s.text)}`];
    case "undo":
      return tap(id("undoAction"));
  }
  switch (step.expect) {
    case "account":
      return visible(id("authAccount"), [`    text: ${q(literal(runEmail(s.email!)))}`]);
    case "authError":
      return visible(id("authError"), [`    text: ${q(literal(s.text!))}`]);
    case "clearCompleted":
      return visible(id("clearCompleted"), [`    text: ${q(s.text)}`]);
    case "completed":
      return visible(id("itemToggle", s.title!), [`    checked: ${s.value}`]);
    case "deleteDialog":
      return [`- assertVisible:`, `    text: ${q(`.*${literal(runEmail(s.email!))}.*`)}`];
    case "dueDate":
      return visible(id("itemDueDate", s.title!), [`    text: ${q(s.dueDate)}`]);
    case "empty":
      return visible(id("empty"));
    case "guestBanner":
      return step.value ? visible(id("authGuestBanner")) : hidden(id("authGuestBanner"));
    case "movePrompt":
      return s.text === null ? hidden(id("authMoveConfirm")) : [`- assertVisible:`, `    text: ${q(literal(s.text!))}`];
    case "overdue":
      return step.value
        ? visible(id("itemOverdue", s.title!))
        : [`- assertNotVisible:`, `    id: ${q(id("itemOverdue", s.title!))}`];
    case "priority":
      return visible(id("itemPriority", s.title!), [`    text: ${q(capitalize(s.priority!))}`]);
    case "quickAddPreview":
      return s.title === null
        ? [`- assertNotVisible:`, `    id: ${q(id("quickAddPreview"))}`]
        : visible(id("quickAddPreviewTitle"), [`    text: ${q(s.title)}`]);
    case "recurrence":
      return visible(id("itemRecurrence", s.title!), [`    text: ${q(s.text)}`]);
    case "remaining":
      return visible(id("remaining"), [`    text: ${q(s.text)}`]);
    case "reminder":
      return visible(id("itemReminder", s.title!), [`    text: ${q(s.text)}`]);
    case "selected":
      return visible(id("selectedCount"), [`    text: ${q(s.text)}`]);
    case "stats":
      return [
        ...visible(id("statsTotal"), [`    text: ${q(s.total)}`]),
        ...visible(id("statsCurrent"), [`    text: ${q(s.current)}`]),
        ...visible(id("statsLongest"), [`    text: ${q(s.longest)}`]),
      ];
    case "subtaskProgress":
      return visible(id("itemSubtaskProgress", s.title!), [`    text: ${q(s.text)}`]);
    case "theme":
      return visible(id("themeOption", s.theme), ["    selected: true"]);
    case "titles":
      return s.titles!.length === 0 ? visible(id("empty")) : s.titles!.flatMap((title) => visible(id("item", title)));
    case "undo":
      return s.label === null
        ? [`- assertNotVisible:`, `    id: ${q(id("undoToast"))}`]
        : visible(id("undoLabel"), [`    text: ${q(s.label)}`]);
  }
  throw new Error(`Unknown step ${JSON.stringify(step)}`);
}

const NATIVE = ["ios", "android"] as const;

function maestroFlows(): Record<string, string> {
  const flows: Record<string, string> = {};
  for (const scenario of loadScenarios()) {
    if (scenario.status.ios === "n/a" && scenario.status.android === "n/a") continue;
    // Scenarios no native platform runs yet (e.g. ones needing steps Maestro can't drive) get no flow.
    if (scenario.requires && !NATIVE.some((platform) => scenario.status[platform] === "pass")) continue;
    const ctx = {};
    const setup = scenario.requires ? ["- evalScript: ${output.run = String(Date.now())}"] : [];
    const body = ["- runFlow: launch.yaml", ...setup, ...scenario.steps.flatMap((step) => maestroStep(step, ctx))];
    // `spec` flows run on any build; `supabase` flows need a configured build + the local stack (spec/README.md).
    const tag = scenario.requires ?? "spec";
    flows[`spec/scenarios/maestro/${scenario.name}.yaml`] =
      `# Generated from spec/scenarios/core/${scenario.file} by \`pnpm spec:generate\`. Do not edit.\nappId: \${APP_ID}\nname: ${scenario.name}\ntags:\n  - ${tag}\n---\n${body.join("\n")}\n`;
  }
  return flows;
}

const messages = Object.entries(readJson<Record<string, string>>(join(SPEC_DIR, "i18n/en.json"))).filter(
  ([key]) => !key.startsWith("$"),
);
const I18N_HEADER = "Generated from spec/i18n/en.json by `pnpm spec:generate`. Do not edit.";

function catalogs(): Record<string, string> {
  return {
    "apps/web/src/domain/i18n/en.ts": `// ${I18N_HEADER}\n\nexport const en = {\n${messages
      .map(([key, value]) => `  ${q(key)}: ${q(value)},`)
      .join(
        "\n",
      )}\n} as const;\n\nexport type MessageKey = keyof typeof en;\nexport type Messages = Record<MessageKey, string>;\n`,
    "apps/android/app/src/main/res/values/messages.xml": androidXml(messages, I18N_HEADER),
    "apps/android/app/src/main/kotlin/com/reedwilliams24/todotracker/ui/Messages.kt": androidTable(
      messages,
      "com.reedwilliams24.todotracker",
      "com.reedwilliams24.todotracker.ui",
      I18N_HEADER,
    ),
    "apps/ios/TodoTracker/Localizable.xcstrings": xcstrings(messages),
    "apps/ios/TodoTracker/Messages.swift": swiftTable(messages, I18N_HEADER),
  };
}

const outputs: Record<string, string> = {
  "spec/test-ids.json": sortedIds,
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
  console.error("Generated files are out of date (or spec/test-ids.json is not sorted). Run `pnpm spec:generate`.");
  process.exit(1);
}
console.log(check ? "generated files up to date" : `wrote ${stale} file(s)`);
