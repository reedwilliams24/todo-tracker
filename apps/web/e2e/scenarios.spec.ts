import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** Runs the platform-neutral scenarios in spec/scenarios/core/*.json against the web app. */
type Step = Record<string, unknown> & { do?: string; expect?: string };
type Scenario = { name: string; status: { web: string }; steps: Step[] };

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

async function visibleTitles(page: Page): Promise<string[]> {
  const testIds = await page
    .locator(`[data-testid^="${ITEM_PREFIX}"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? ""));
  return testIds.map((testId) => testId.slice(ITEM_PREFIX.length));
}

async function run(page: Page, step: Step) {
  const s = step as Record<string, string> & {
    value?: boolean;
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
    case "bulkDelete":
      await page.getByTestId(id("bulkDelete")).click();
      return page.getByTestId(id(step.confirm ? "bulkDeleteConfirm" : "bulkDeleteCancel")).click();
    case "bulkToggle":
      return page.getByTestId(id("bulkToggle")).click();
    case "clearCompleted":
      return page.getByTestId(id("clearCompleted")).click();
    case "delete":
      return page.getByTestId(id("itemDelete", s.title!)).click();
    case "filter":
      return page.getByTestId(id("filter", s.filter)).click();
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
    case "search":
      return page.getByTestId(id("search")).fill(s.query!);
    case "select":
      return page.getByTestId(id("itemSelect", s.title!)).click();
    case "selectAll":
      return page.getByTestId(id("selectAll")).click();
    case "selectMode":
      return page.getByTestId(id("selectMode")).click();
    case "sort":
      return void (await page.getByTestId(id("sort")).selectOption(s.sort!));
    case "submit":
      return page.getByTestId(id("formSubmit")).click();
    case "theme":
      return page.getByTestId(id("themeOption", s.theme)).click();
    case "toggle":
      return page.getByTestId(id("itemToggle", s.title!)).click();
    case "type":
      return page.getByTestId(id("formTitle")).fill(s.text!);
    case "undo":
      return page.getByTestId(id("undoAction")).click();
  }
  switch (step.expect) {
    case "clearCompleted":
      return expect(page.getByTestId(id("clearCompleted"))).toHaveText(s.text!);
    case "completed":
      return expect(page.getByTestId(id("itemToggle", s.title!))).toBeChecked({ checked: s.value });
    case "dueDate":
      return expect(
        page.getByTestId(id("itemDueDate", s.title!)).filter({ hasText: s.dueDate! }).first(),
      ).toBeVisible();
    case "empty":
      return expect(page.getByTestId(id("empty"))).toBeVisible();
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
    test(scenario.name, async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      for (const step of scenario.steps) {
        await test.step(JSON.stringify(step), () => run(page, step));
      }
    });
  }
});
