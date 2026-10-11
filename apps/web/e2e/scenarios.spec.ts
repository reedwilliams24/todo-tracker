import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { AUTH, type Ctx, run, SPEC_DIR, type Step } from "./steps";

/** Runs the platform-neutral scenarios in spec/scenarios/core/*.json against the web app. */
type Scenario = { name: string; status: { web: string }; requires?: string; steps: Step[] };

const SCENARIOS_DIR = join(SPEC_DIR, "scenarios/core");
const scenarios = readdirSync(SCENARIOS_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(join(SCENARIOS_DIR, file), "utf8")) as Scenario);

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
