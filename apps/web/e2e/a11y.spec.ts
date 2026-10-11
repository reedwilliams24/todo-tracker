import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoViolations(page: import("@playwright/test").Page) {
  // let hydration and color transitions settle before sampling contrast
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("empty state has no axe violations", async ({ page }) => {
  await expectNoViolations(page);
});

test("populated list has no axe violations in light and dark", async ({ page }) => {
  await page.getByLabel("Todo title").fill("Water plants");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByLabel("Todo title").fill("Done thing");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("checkbox", { name: 'Mark "Done thing" as complete' }).check();
  await expectNoViolations(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await expectNoViolations(page);
});

test("controls are reachable by keyboard in order", async ({ page }) => {
  await page.getByLabel("Todo title").fill("Keyboard");
  await page.getByRole("button", { name: "Add" }).click();

  await page.getByLabel("Todo title").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Priority")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Due date")).toBeFocused();
});
