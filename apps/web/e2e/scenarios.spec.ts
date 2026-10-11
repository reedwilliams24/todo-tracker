import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** Runs the platform-neutral scenarios in spec/scenarios/core/*.json against the web app. */
type Step = Record<string, unknown> & { do?: string; expect?: string };
type Scenario = { name: string; status: { web: string }; requires?: string; steps: Step[] };
/** Per-test state: scenario emails are made unique per run so resend limits and Mailpit searches never collide. */
type Ctx = { emails: Map<string, string>; email?: string };

const SPEC_DIR = join(process.cwd(), "../../spec");
const ids = JSON.parse(readFileSync(join(SPEC_DIR, "test-ids.json"), "utf8")) as Record<string, string>;
const SCENARIOS_DIR = join(SPEC_DIR, "scenarios/core");
const scenarios = readdirSync(SCENARIOS_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(join(SCENARIOS_DIR, file), "utf8")) as Scenario);

function id(key: string, value = ""): string {
  const pattern = ids[key];
  if (!pattern) throw new Error(`Unknown test id "${key}"`);
  return pattern.replace(/\{\w+\}/, value);
}

const ITEM_PREFIX = id("item");
const AUTH = !!process.env.E2E_SUPABASE;
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

function uniqueEmail(ctx: Ctx, email: string): string {
  if (!ctx.emails.has(email)) {
    const [local, domain] = email.split("@");
    ctx.emails.set(email, `${local}+${Date.now()}${Math.floor(Math.random() * 1e6)}@${domain}`);
  }
  return ctx.emails.get(email)!;
}

/** The newest 6-digit code Mailpit received for `email`. */
async function emailedCode(email: string): Promise<string> {
  let code = "";
  await expect
    .poll(
      async () => {
        const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
        const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
        if (!messages[0]) return "";
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as {
          Text?: string;
          HTML?: string;
        };
        code = `${message.Text ?? ""} ${message.HTML ?? ""}`.match(/\b(\d{6})\b/)?.[1] ?? "";
        return code;
      },
      { timeout: 15_000 },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

async function requestCode(page: Page, ctx: Ctx, email: string) {
  ctx.email = uniqueEmail(ctx, email);
  await page.getByTestId(id("authSignIn")).click();
  await page.getByTestId(id("authEmail")).fill(ctx.email);
  await page.getByTestId(id("authSendCode")).click();
  await expect(page.getByTestId(id("authCode"))).toBeVisible();
}

async function enterCode(page: Page, ctx: Ctx, code: string) {
  await page.getByTestId(id("authCode")).fill(code === "{emailed}" ? await emailedCode(ctx.email!) : code);
  await page.getByTestId(id("authVerify")).click();
}

async function visibleTitles(page: Page): Promise<string[]> {
  const testIds = await page
    .locator(`[data-testid^="${ITEM_PREFIX}"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? ""));
  return testIds.map((testId) => testId.slice(ITEM_PREFIX.length));
}

async function run(page: Page, step: Step, ctx: Ctx) {
  const s = step as Record<string, string> & {
    value?: boolean;
    text?: string | null;
    titles?: string[];
    label?: string | null;
    title?: string | null;
  };
  switch (step.do) {
    case "add":
      await page.getByTestId(id("formTitle")).fill(s.title!);
      if (s.priority) await page.getByTestId(id("formPriority")).selectOption(s.priority);
      if (s.dueDate) await page.getByTestId(id("formDueDate")).fill(s.dueDate);
      if (s.recurrence) await page.getByTestId(id("formRecurrence")).selectOption(s.recurrence);
      if (s.reminder) await page.getByTestId(id("formReminder")).selectOption(s.reminder);
      await page.getByTestId(id("formSubmit")).click();
      await expect(page.getByTestId(id("item", s.title!))).toBeVisible();
      return;
    case "addSubtask":
      await page.getByTestId(id("subtaskInput", s.title!)).fill(s.subtask!);
      await page.getByTestId(id("subtaskInput", s.title!)).press("Enter");
      return expect(page.getByTestId(id("subtask", s.subtask!))).toBeVisible();
    case "bulkDelete":
      await page.getByTestId(id("bulkDelete")).click();
      return page.getByTestId(id(step.confirm ? "bulkDeleteConfirm" : "bulkDeleteCancel")).click();
    case "bulkToggle":
      return page.getByTestId(id("bulkToggle")).click();
    case "cancelDeleteAccount":
      await page.getByTestId(id("authDeleteCancel")).click();
      return expect(page.getByTestId(id("authDeleteDialog"))).toBeHidden();
    case "chooseGuestTodos":
      return page.getByTestId(id(s.choice === "move" ? "authMoveConfirm" : "authMoveDiscard")).click();
    case "clearCompleted":
      return page.getByTestId(id("clearCompleted")).click();
    case "confirmDeleteAccount":
      await page.getByTestId(id("authDeleteConfirm")).click();
      return expect(page.getByTestId(id("authAccount"))).toBeHidden();
    case "delete":
      return page.getByTestId(id("itemDelete", s.title!)).click();
    case "deleteSubtask":
      return page.getByTestId(id("subtaskDelete", s.subtask!)).click();
    case "enterCode":
      return enterCode(page, ctx, s.code!);
    case "expandSubtasks":
      return page.getByTestId(id("itemSubtasksToggle", s.title!)).click();
    case "filter":
      return page.getByTestId(id("filter", s.filter)).click();
    case "forgetLocalTodos":
      // Drop this device's account cache and cursor (not the session), so the list has to come from the server.
      return page.evaluate(() => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("todo-tracker:account:") || key.startsWith("todo-tracker:sync-cursor:")) {
            if (!key.endsWith(":owner")) localStorage.removeItem(key);
          }
        }
      });
    case "move":
      return page.getByTestId(id("item", s.title!)).dragTo(page.getByTestId(id("item", s.onto!)));
    case "openDeleteAccount":
      await page.getByTestId(id("authAccount")).click();
      await page.getByTestId(id("authDeleteAccount")).click();
      return expect(page.getByTestId(id("authDeleteDialog"))).toBeVisible();
    case "openStats":
      return page.getByTestId(id("statsToggle")).click();
    case "relaunch":
      return void (await page.reload());
    case "rename":
      await page.getByTestId(id("itemTitle", s.from)).dblclick();
      await page.getByTestId(id("itemEditInput")).fill(s.to!);
      return page.getByTestId(id("itemEditInput")).press("Enter");
    case "requestCode":
      return requestCode(page, ctx, s.email!);
    case "search":
      return page.getByTestId(id("search")).fill(s.query!);
    case "select":
      return page.getByTestId(id("itemSelect", s.title!)).click();
    case "selectAll":
      return page.getByTestId(id("selectAll")).click();
    case "selectMode":
      return page.getByTestId(id("selectMode")).click();
    case "signIn":
      await requestCode(page, ctx, s.email!);
      return enterCode(page, ctx, "{emailed}");
    case "signOut":
      await page.getByTestId(id("authAccount")).click();
      await page.getByTestId(id("authSignOut")).click();
      return expect(page.getByTestId(id("authAccount"))).toBeHidden();
    case "sort":
      return void (await page.getByTestId(id("sort")).selectOption(s.sort!));
    case "submit":
      return page.getByTestId(id("formSubmit")).click();
    case "theme":
      return page.getByTestId(id("themeOption", s.theme)).click();
    case "toggle":
      return page.getByTestId(id("itemToggle", s.title!)).click();
    case "toggleSubtask":
      return page.getByTestId(id("subtaskToggle", s.subtask!)).click();
    case "type":
      return page.getByTestId(id("formTitle")).fill(s.text!);
    case "undo":
      return page.getByTestId(id("undoAction")).click();
  }
  switch (step.expect) {
    case "account":
      return expect(page.getByTestId(id("authAccount"))).toHaveText(uniqueEmail(ctx, s.email!));
    case "authError":
      return expect(page.getByTestId(id("authError"))).toHaveText(s.text!);
    case "clearCompleted":
      return expect(page.getByTestId(id("clearCompleted"))).toHaveText(s.text!);
    case "completed":
      return expect(page.getByTestId(id("itemToggle", s.title!))).toBeChecked({ checked: s.value });
    case "deleteDialog":
      return expect(page.getByTestId(id("authDeleteDialog"))).toContainText(uniqueEmail(ctx, s.email!));
    case "dueDate":
      return expect(
        page.getByTestId(id("itemDueDate", s.title!)).filter({ hasText: s.dueDate! }).first(),
      ).toBeVisible();
    case "empty":
      return expect(page.getByTestId(id("empty"))).toBeVisible();
    case "guestBanner":
      if (s.value) return expect(page.getByTestId(id("authGuestBanner"))).toBeVisible();
      return expect(page.getByTestId(id("authGuestBanner"))).toBeHidden();
    case "movePrompt":
      if (s.text === null) return expect(page.getByTestId(id("authMovePrompt"))).toBeHidden();
      return expect(page.getByTestId(id("authMovePrompt"))).toContainText(s.text!);
    case "overdue":
      if (s.value) return expect(page.getByTestId(id("itemOverdue", s.title!))).toBeVisible();
      return expect(page.getByTestId(id("itemOverdue", s.title!))).toBeHidden();
    case "priority":
      return expect(page.getByTestId(id("itemPriority", s.title!))).toHaveText(new RegExp(`^${s.priority}$`, "i"));
    case "quickAddPreview":
      if (s.title === null) return expect(page.getByTestId(id("quickAddPreview"))).toBeHidden();
      return expect(page.getByTestId(id("quickAddPreviewTitle"))).toHaveText(s.title!);
    case "recurrence":
      return expect(
        page.getByTestId(id("itemRecurrence", s.title!)).filter({ hasText: s.text! }).first(),
      ).toBeVisible();
    case "remaining":
      return expect(page.getByTestId(id("remaining"))).toHaveText(s.text!);
    case "reminder":
      return expect(page.getByTestId(id("itemReminder", s.title!))).toHaveText(s.text!);
    case "selected":
      return expect(page.getByTestId(id("selectedCount"))).toHaveText(s.text!);
    case "stats":
      await expect(page.getByTestId(id("statsTotal"))).toHaveText(s.total!);
      await expect(page.getByTestId(id("statsCurrent"))).toHaveText(s.current!);
      return expect(page.getByTestId(id("statsLongest"))).toHaveText(s.longest!);
    case "subtaskProgress":
      return expect(page.getByTestId(id("itemSubtaskProgress", s.title!))).toHaveText(s.text!);
    case "theme":
      await expect(page.getByTestId(id("themeOption", s.theme))).toHaveAttribute("aria-checked", "true");
      if (s.theme === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      if (s.theme === "light") await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
      return;
    case "titles":
      if (s.titles!.length === 0) return expect(page.getByTestId(id("empty"))).toBeVisible();
      return expect.poll(() => visibleTitles(page)).toEqual(s.titles);
    case "undo":
      if (s.label === null) return expect(page.getByTestId(id("undoToast"))).toBeHidden();
      return expect(page.getByTestId(id("undoLabel"))).toHaveText(s.label!);
  }
  throw new Error(`Unknown step ${JSON.stringify(step)}`);
}

test.describe("spec scenarios", () => {
  for (const scenario of scenarios) {
    if (scenario.status.web === "n/a") continue;
    if (!!scenario.requires !== AUTH) continue;
    test(scenario.name, async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      const ctx: Ctx = { emails: new Map() };
      for (const step of scenario.steps) {
        await test.step(JSON.stringify(step), () => run(page, step, ctx));
      }
    });
  }
});

test.describe("realtime", () => {
  test.skip(!AUTH, "needs the local Supabase stack (pnpm e2e:auth)");

  test("an add on one device appears on another without a reload", async ({ browser }) => {
    const a = await browser.newContext();
    const pageA = await a.newPage();
    await pageA.goto("/");
    const ctx: Ctx = { emails: new Map() };
    await run(pageA, { do: "signIn", email: "realtime@example.com" }, ctx);
    await expect(pageA.getByTestId(id("authAccount"))).toBeVisible();

    // The second device is the same account in a separate browser context (its own tab, socket and cache).
    const b = await browser.newContext({ storageState: await a.storageState() });
    const pageB = await b.newPage();
    await pageB.goto("/");
    await expect(pageB.getByTestId(id("authAccount"))).toBeVisible();
    await expect(pageB.getByTestId(id("empty"))).toBeVisible();
    let reloads = 0;
    pageB.on("load", () => reloads++);

    await run(pageA, { do: "type", text: "Buy milk" }, ctx);
    await run(pageA, { do: "submit" }, ctx);
    await expect.poll(() => visibleTitles(pageA)).toEqual(["Buy milk"]);

    await expect.poll(() => visibleTitles(pageB), { timeout: 10_000 }).toEqual(["Buy milk"]);
    expect(reloads).toBe(0);
    await a.close();
    await b.close();
  });
});
