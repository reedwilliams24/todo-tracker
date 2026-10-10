import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** Runs the platform-neutral scenarios in spec/scenarios/core.json against the web app. */
type Step = Record<string, unknown> & { do?: string; expect?: string };
type Scenario = { name: string; platforms?: string[]; steps: Step[] };

const SPEC_DIR = join(process.cwd(), "../../spec");
const ids = JSON.parse(readFileSync(join(SPEC_DIR, "test-ids.json"), "utf8")) as Record<string, string>;
const { scenarios } = JSON.parse(readFileSync(join(SPEC_DIR, "scenarios/core.json"), "utf8")) as {
  scenarios: Scenario[];
};

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
  const s = step as Record<string, string> & { value?: boolean; titles?: string[]; label?: string | null };
  switch (step.do) {
    case "add":
      await page.getByTestId(id("formTitle")).fill(s.title!);
      if (s.priority) await page.getByTestId(id("formPriority")).selectOption(s.priority);
      if (s.dueDate) await page.getByTestId(id("formDueDate")).fill(s.dueDate);
      await page.getByTestId(id("formSubmit")).click();
      await expect(page.getByTestId(id("item", s.title))).toBeVisible();
      return;
    case "toggle":
      return page.getByTestId(id("itemToggle", s.title)).click();
    case "delete":
      return page.getByTestId(id("itemDelete", s.title)).click();
    case "rename":
      await page.getByTestId(id("itemTitle", s.from)).dblclick();
      await page.getByTestId(id("itemEditInput")).fill(s.to!);
      return page.getByTestId(id("itemEditInput")).press("Enter");
    case "filter":
      return page.getByTestId(id("filter", s.filter)).click();
    case "search":
      return page.getByTestId(id("search")).fill(s.query!);
    case "clearCompleted":
      return page.getByTestId(id("clearCompleted")).click();
    case "undo":
      return page.getByTestId(id("undoAction")).click();
    case "relaunch":
      return void (await page.reload());
  }
  switch (step.expect) {
    case "empty":
      return expect(page.getByTestId(id("empty"))).toBeVisible();
    case "titles":
      if (s.titles!.length === 0) return expect(page.getByTestId(id("empty"))).toBeVisible();
      return expect.poll(() => visibleTitles(page)).toEqual(s.titles);
    case "remaining":
      return expect(page.getByTestId(id("remaining"))).toHaveText(s.text!);
    case "completed":
      return expect(page.getByTestId(id("itemToggle", s.title))).toBeChecked({ checked: s.value });
    case "undo":
      if (s.label === null) return expect(page.getByTestId(id("undoToast"))).toBeHidden();
      return expect(page.getByTestId(id("undoLabel"))).toHaveText(s.label!);
  }
  throw new Error(`Unknown step ${JSON.stringify(step)}`);
}

test.describe("spec scenarios", () => {
  for (const scenario of scenarios) {
    if (scenario.platforms && !scenario.platforms.includes("web")) continue;
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
