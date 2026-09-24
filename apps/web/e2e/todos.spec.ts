import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "todo-tracker:todos:v1";

async function addTodo(page: Page, title: string) {
  await page.getByLabel("Todo title").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Todo Tracker" })).toBeVisible();
  await expect(page.getByText("No todos yet. Add your first one above.")).toBeVisible();
});

test("adds a todo", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Add" })).toBeDisabled();

  await page.getByLabel("Todo title").fill("Buy milk");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByRole("button", { name: "Add" }).click();

  const item = page.getByRole("listitem").filter({ hasText: "Buy milk" });
  await expect(item).toBeVisible();
  await expect(item).toContainText("high");
  await expect(page.getByLabel("Todo title")).toHaveValue("");
  await expect(page.getByText("1 task remaining")).toBeVisible();
});

test("toggles a todo complete and back to active", async ({ page }) => {
  await addTodo(page, "Walk the dog");

  const checkbox = page.getByRole("checkbox", { name: 'Mark "Walk the dog" as complete' });
  await checkbox.check();

  await expect(page.getByRole("checkbox", { name: 'Mark "Walk the dog" as active' })).toBeChecked();
  await expect(page.getByText("0 tasks remaining")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear completed" })).toBeVisible();

  await page.getByRole("checkbox", { name: 'Mark "Walk the dog" as active' }).uncheck();
  await expect(page.getByRole("checkbox", { name: 'Mark "Walk the dog" as complete' })).not.toBeChecked();
  await expect(page.getByText("1 task remaining")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear completed" })).toBeHidden();
});

test("deletes a todo", async ({ page }) => {
  await addTodo(page, "Delete me");
  await addTodo(page, "Keep me");

  await page.getByRole("button", { name: 'Delete "Delete me"' }).click();

  await expect(page.getByRole("listitem").filter({ hasText: "Delete me" })).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "Keep me" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);
});

test("edits a todo inline and persists the change", async ({ page }) => {
  await addTodo(page, "Old title");

  await page.getByRole("button", { name: 'Edit "Old title"' }).dblclick();
  const editor = page.getByLabel("Edit title");
  await expect(editor).toBeFocused();

  await editor.fill("   ");
  await editor.press("Enter");
  await expect(page.getByRole("button", { name: 'Edit "Old title"' })).toBeVisible();

  await page.getByRole("button", { name: 'Edit "Old title"' }).dblclick();
  await page.getByLabel("Edit title").fill("Discarded");
  await page.getByLabel("Edit title").press("Escape");
  await expect(page.getByRole("button", { name: 'Edit "Old title"' })).toBeVisible();

  await page.getByRole("button", { name: 'Edit "Old title"' }).dblclick();
  await page.getByLabel("Edit title").fill("New title");
  await page.getByLabel("Edit title").press("Enter");
  await expect(page.getByRole("button", { name: 'Edit "New title"' })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);

  await expect
    .poll(async () =>
      page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    )
    .toContain("New title");

  await page.reload();
  await expect(page.getByRole("button", { name: 'Edit "New title"' })).toBeVisible();
  await expect(page.getByText("Old title")).toBeHidden();
});

test("filters todos by all, active and completed", async ({ page }) => {
  await addTodo(page, "Active task");
  await addTodo(page, "Done task");
  await page.getByRole("checkbox", { name: 'Mark "Done task" as complete' }).check();

  const filters = page.getByRole("tablist", { name: "Filter todos" });

  await filters.getByRole("tab", { name: "active" }).click();
  await expect(filters.getByRole("tab", { name: "active" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "Active task" })).toBeVisible();

  await filters.getByRole("tab", { name: "completed" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "Done task" })).toBeVisible();

  await filters.getByRole("tab", { name: "all" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Clear completed" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await filters.getByRole("tab", { name: "completed" }).click();
  await expect(page.getByText("No completed todos.")).toBeVisible();
});

test("searches todos and combines with the status filter", async ({ page }) => {
  await addTodo(page, "Buy Milk");
  await addTodo(page, "Walk the dog");
  await addTodo(page, "Feed the dog");
  await page.getByRole("checkbox", { name: 'Mark "Feed the dog" as complete' }).check();

  const search = page.getByLabel("Search todos");
  await search.fill("DOG");
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("listitem").filter({ hasText: "Buy Milk" })).toBeHidden();

  const filters = page.getByRole("tablist", { name: "Filter todos" });
  await filters.getByRole("tab", { name: "active" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "Walk the dog" })).toBeVisible();

  await search.fill("milk");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "Buy Milk" })).toBeVisible();

  await search.fill("zzz");
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText("No active todos match “zzz”.")).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await search.fill("milk");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.getByRole("listitem")).toHaveCount(2);
});

test("persists todos across page reload via localStorage", async ({ page }) => {
  await addTodo(page, "Persist me");
  await page.getByRole("checkbox", { name: 'Mark "Persist me" as complete' }).check();

  await expect
    .poll(async () =>
      page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    )
    .toContain("Persist me");

  await page.reload();

  const item = page.getByRole("listitem").filter({ hasText: "Persist me" });
  await expect(item).toBeVisible();
  await expect(page.getByRole("checkbox", { name: 'Mark "Persist me" as active' })).toBeChecked();
  await expect(page.getByText("0 tasks remaining")).toBeVisible();
});

test("stats panel counts completions and a one-day streak", async ({ page }) => {
  await page.getByLabel("Todo title").fill("Stretch");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("checkbox", { name: 'Mark "Stretch" as complete' }).check();

  await page.getByRole("button", { name: "Stats Show" }).click();
  await expect(page.getByTestId("stat-total")).toHaveText("1");
  await expect(page.getByTestId("stat-current")).toHaveText("1d");
  await expect(page.getByTestId("stat-longest")).toHaveText("1d");
  await expect(page.getByLabel("Completed per day, last 30 days").getByRole("listitem")).toHaveCount(30);

  await page.reload();
  await page.getByRole("button", { name: "Stats Show" }).click();
  await expect(page.getByTestId("stat-total")).toHaveText("1");
});
