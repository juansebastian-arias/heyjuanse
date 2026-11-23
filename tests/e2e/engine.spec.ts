import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BASE } from "@/core/flow/company";
import { assumptionGroups } from "@/lib/flow/assumptions";
import { watchErrors } from "./helpers";

test.describe("how it is built", () => {
  test("is one page with a title and a way around it", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/engine");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The model behind the page");
    await expect(page).toHaveTitle("How it is built · Juan Sebastián Arias");

    // Every entry in the list of contents leads to a section that is there.
    const links = page.getByRole("navigation", { name: "On this page" }).getByRole("link");
    const targets = await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute("href") ?? ""),
    );
    expect(targets.length).toBeGreaterThan(5);
    for (const target of targets) {
      expect(target).toMatch(/^#[a-z]+$/);
      await expect(page.locator(`section${target}`)).toHaveCount(1);
      await expect(page.locator(`section${target} h2`)).toHaveCount(1);
    }
    await links.filter({ hasText: "How it was checked" }).click();
    await expect(page).toHaveURL(/\/engine#checks$/);
    await expect(page.locator("#checks h2")).toBeInViewport();
    expect(errors).toEqual([]);
  });

  test("draws the life of a request, and says the same thing in words", async ({ page }) => {
    await page.goto("/engine");
    const drawing = page.getByRole("img", { name: /How a request moves through Larkspur/ });
    await expect(drawing).toBeVisible();
    const box = await drawing.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    // The rules beside it are built from the model's own numbers.
    const states = page.locator("#states");
    await expect(states).toContainText(
      `${Math.round(BASE.invoiceErrorShare * 100)}% of hand-typed`,
    );
    await expect(states).toContainText(`${BASE.disputeDays} days later`);
    await expect(states).toContainText(`after ${BASE.paymentDays} days`);
  });

  test("lists every assumption with the value the model uses", async ({ page }) => {
    await page.goto("/engine");
    const table = page.locator("#assumptions table");
    const groups = assumptionGroups(BASE);
    const rows = groups.flatMap((group) => group.rows);
    expect(rows.length).toBeGreaterThan(20);
    await expect(table.locator("th[scope=row]")).toHaveCount(rows.length);
    for (const row of rows) {
      const line = table.locator("tr").filter({ has: page.getByText(row.label, { exact: true }) });
      await expect(line.locator("td")).toHaveText(row.value);
    }
  });

  test("shows the engine agreeing with the formulas when the page was built", async ({ page }) => {
    await page.goto("/engine");
    const rows = page.locator("#checks table").first().locator("tbody tr");
    const total = await rows.count();
    expect(total).toBeGreaterThanOrEqual(7);
    for (let index = 0; index < total; index++) {
      await expect(rows.nth(index).locator("td").last()).toHaveText("Yes");
    }
    await expect(page.locator("#checks")).toContainText(`${total} of ${total} comparisons agreed`);
  });

  test("publishes the automated tests, by file and by name", async ({ page }) => {
    await page.goto("/engine");
    const report = JSON.parse(
      readFileSync(join(process.cwd(), ".reports", "vitest.json"), "utf8"),
    ) as {
      numTotalTests: number;
      numPassedTests: number;
      testResults: Array<{ name: string }>;
    };
    const checks = page.locator("#checks");
    await expect(checks).toContainText(
      `${report.numPassedTests} of ${report.numTotalTests} tests passed`,
    );
    const files = checks.locator("details");
    await expect(files).toHaveCount(report.testResults.length);
    // A file opens to the statements it tests, written as sentences about the company.
    const engine = files.filter({ hasText: "core/flow/engine.test.ts" });
    await engine.locator("summary").click();
    expect(await engine.locator("li").count()).toBeGreaterThan(10);
  });

  test("leads back to the company", async ({ page }) => {
    await page.goto("/engine");
    await page.getByRole("link", { name: "Back to the company" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find where this company");
  });
});
