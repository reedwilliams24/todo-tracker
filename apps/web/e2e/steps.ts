import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Scenario steps (spec/scenarios/core) and helpers shared by the web e2e specs. */
export type Step = Record<string, unknown> & { do?: string; expect?: string };
/** Per-test state: scenario emails are made unique per run so resend limits and Mailpit searches never collide. */
export type Ctx = { emails: Map<string, string>; email?: string };

export const SPEC_DIR = join(process.cwd(), "../../spec");
const ids = JSON.parse(readFileSync(join(SPEC_DIR, "test-ids.json"), "utf8")) as Record<string, string>;

export function id(key: string, value = ""): string {
  const pattern = ids[key];
  if (!pattern) throw new Error(`Unknown test id "${key}"`);
  return pattern.replace(/\{\w+\}/, value);
}

const ITEM_PREFIX = id("item");
export const AUTH = !!process.env.E2E_SUPABASE;
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(ctx: Ctx, email: string): string {
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

/** Fakes the tab being hidden or shown again (`visibilitychange`), which closes / reopens the Realtime socket. */
export async function setVisibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

export async function visibleTitles(page: Page): Promise<string[]> {
  const testIds = await page
    .locator(`[data-testid^="${ITEM_PREFIX}"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? ""));
  return testIds.map((testId) => testId.slice(ITEM_PREFIX.length));
}

export async function run(page: Page, step: Step, ctx: Ctx) {
  const s = step as Record<string, string> & {
    value?: boolean;
    text?: string | null;
    titles?: string[];
    label?: string | null;
    title?: string | null;
  };
  switch (step.do) {
    case "background":
      return setVisibility(page, "hidden");
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
    case "chooseGuestTodos":
      return page.getByTestId(id(s.choice === "move" ? "authMoveConfirm" : "authMoveDiscard")).click();
    case "clearCompleted":
      return page.getByTestId(id("clearCompleted")).click();
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
    case "foreground":
      return setVisibility(page, "visible");
    case "forgetLocalTodos":
      // Drop this device's account cache and cursor (not the session), so the list has to come from the server.
      return page.evaluate(() => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("todo-tracker:account:") || key.startsWith("todo-tracker:sync-cursor:")) {
            if (!key.endsWith(":owner")) localStorage.removeItem(key);
          }
        }
      });
    case "goOffline":
      return page.context().setOffline(true);
    case "goOnline":
      return page.context().setOffline(false);
    case "move":
      return page.getByTestId(id("item", s.title!)).dragTo(page.getByTestId(id("item", s.onto!)));
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
    case "connectionBanner":
      if (s.text === null) return expect(page.getByTestId(id("connectionBanner"))).toBeHidden();
      return expect(page.getByTestId(id("connectionBanner"))).toContainText(s.text!);
    case "dueDate":
      return expect(
        page.getByTestId(id("itemDueDate", s.title!)).filter({ hasText: s.dueDate! }).first(),
      ).toBeVisible();
    case "editable": {
      // Add, complete and delete are enabled only while the list can be edited (spec/features/realtime.md).
      const controls = [page.getByTestId(id("formTitle")), page.getByTestId(id("formSubmit"))];
      if (s.title)
        controls.push(page.getByTestId(id("itemToggle", s.title)), page.getByTestId(id("itemDelete", s.title)));
      if (s.value) return expect(controls[0]).toBeEnabled();
      for (const control of controls) await expect(control).toBeDisabled();
      return;
    }
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
