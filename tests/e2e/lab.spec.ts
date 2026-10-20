import { expect, test } from "@playwright/test";
import {
  expectedMetrics,
  expectNoAxeViolations,
  metricValue,
  waitForSql,
  watchErrors,
} from "./helpers";

const COUNT_METRICS = [
  "needsReached",
  "callsWithoutNeed",
  "needsMissed",
  "needsWaiting",
  "needsInReview",
  "needsFixData",
  "reviewCases",
] as const;

test("the metrics on screen match the engine for the default rules", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/lab");
  await waitForSql(page);
  const { metrics } = expectedMetrics();
  for (const id of COUNT_METRICS) {
    expect(await metricValue(page, id), id).toBe(String(metrics[id]));
  }
  await expect(page.getByText(/SQL and the reference implementation disagree/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a shared link restores the rules it was made with", async ({ page }) => {
  await page.goto("/lab?calls=60&min=45&order=arrival");
  await waitForSql(page);
  await expect(page.getByLabel("Sales calls this week")).toHaveValue("60");
  await expect(page.getByLabel("Score threshold")).toHaveValue("45");
  await expect(page.getByLabel("First come, first served")).toBeChecked();
  const { metrics } = expectedMetrics({ capacity: 60, threshold: 45, queueOrder: "arrival" });
  expect(await metricValue(page, "needsReached")).toBe(String(metrics.needsReached));
});

test.describe("on desktop", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout and keyboard paths.");

  test("moving the calls dial with the keyboard updates the address, metrics and explanation", async ({
    page,
  }) => {
    await page.goto("/lab");
    await waitForSql(page);
    const calls = page.getByLabel("Sales calls this week");
    await calls.focus();
    for (let step = 0; step < 3; step++) await calls.press("ArrowRight");
    await expect(page).toHaveURL(/calls=60/);
    const { metrics } = expectedMetrics({ capacity: 60 });
    await expect(page.locator('[data-metric="needsReached"] .num').first()).toHaveText(
      String(metrics.needsReached),
    );
    await expect(page.getByText(/15 extra calls/).first()).toBeVisible();
  });

  test("a case file opens from the keyboard, explains the decision and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/lab");
    await waitForSql(page);
    const mark = page.locator('[data-lane="sales"][data-need="true"]').first();
    await mark.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Case file · L-\d+/)).toBeVisible();
    await expectNoAxeViolations(page, "dialog");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(mark).toBeFocused();
  });

  test("the perfect-reading experiment is labeled as the answer key, never as AI output", async ({
    page,
  }) => {
    await page.goto("/lab");
    await waitForSql(page);
    await page.getByRole("button", { name: "Try perfect message reading" }).click();
    await expect(page).toHaveURL(/source=answer_key/);
    const { metrics } = expectedMetrics({ extraction: "answer_key", aiPolicy: "high" });
    await expect(page.locator('[data-metric="needsReached"] .num').first()).toHaveText(
      String(metrics.needsReached),
    );
    await expect(page.getByText(/answer key/i).first()).toBeVisible();
  });

  test("the SQL console answers read-only queries and refuses writes", async ({ page }) => {
    await page.goto("/lab?view=hood");
    await waitForSql(page);
    const editor = page.getByLabel("SQL query");
    await editor.fill("DELETE FROM decisions");
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByText(/Only SELECT queries can run here/)).toBeVisible();

    const { decisions } = expectedMetrics();
    await editor.fill("SELECT COUNT(*) AS leads FROM decisions");
    await page.getByRole("button", { name: "Run query" }).click();
    const result = page.getByRole("table", { name: "Query result" });
    await expect(result.getByRole("cell", { name: String(decisions.length) })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe("on phones", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone layout.");

  test("the rules fold into one line and open on request", async ({ page }) => {
    await page.goto("/lab");
    await waitForSql(page);
    const calls = page.getByLabel("Sales calls this week");
    await expect(calls).toBeHidden();
    await page.locator('button[aria-controls="lab-rules"]').click();
    await expect(calls).toBeVisible();
  });

  test("the try-one-change buttons work with a tap", async ({ page }) => {
    await page.goto("/lab");
    await waitForSql(page);
    await page.getByRole("button", { name: "Add 15 sales calls" }).tap();
    await expect(page).toHaveURL(/calls=60/);
  });
});
