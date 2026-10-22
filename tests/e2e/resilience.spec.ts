import { expect, type Page, test } from "@playwright/test";
import { DEFAULT_SETTINGS, LIMITS } from "../../core/settings";
import { expectedMetrics, metricValue, waitForSql } from "./helpers";

/**
 * Uncaught exceptions only. A blocked request is the point of some of these tests, and the
 * browser logs each one as a console error.
 */
function watchCrashes(page: Page): string[] {
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  return crashes;
}

test.describe("when something fails", () => {
  test("if the data cannot load, the lab says so and offers a reload", async ({ page }) => {
    const crashes = watchCrashes(page);
    await page.route("**/data/**", (route) => route.abort());
    await page.goto("/lab");
    const alert = page.getByRole("alert").filter({ hasText: "The lab could not load its data." });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "Reload the page" })).toBeVisible();
    expect(crashes).toEqual([]);
  });

  test("if SQLite cannot start, the reference implementation computes the metrics and the page says so", async ({
    page,
  }) => {
    const crashes = watchCrashes(page);
    await page.route("**/vendor/sql-wasm-browser.wasm", (route) => route.abort());
    await page.goto("/lab");
    await expect(page.getByText(/The SQL engine could not start/).first()).toBeVisible({
      timeout: 20_000,
    });
    const { metrics } = expectedMetrics();
    expect(await metricValue(page, "needsReached")).toBe(String(metrics.needsReached));
    expect(await metricValue(page, "callsWithoutNeed")).toBe(String(metrics.callsWithoutNeed));
    await expect(page.getByText(/Computed by SQLite/)).toHaveCount(0);
    expect(crashes).toEqual([]);
  });

  test("if the stored AI outputs cannot load, AI stays off and the answer key is offered instead", async ({
    page,
  }) => {
    const crashes = watchCrashes(page);
    await page.route("**/ai.json", (route) => route.abort());
    await page.goto("/lab?ai=high");
    await waitForSql(page);
    const aiOff = expectedMetrics({ aiPolicy: "off" }).metrics;
    expect(await metricValue(page, "needsReached")).toBe(String(aiOff.needsReached));
    expect(await metricValue(page, "reviewCases")).toBe("0");
    await page.getByRole("button", { name: "Try perfect message reading" }).click();
    await expect(page).toHaveURL(/source=answer_key/);
    const answerKey = expectedMetrics({ extraction: "answer_key", aiPolicy: "high" }).metrics;
    await expect(page.locator('[data-metric="needsReached"] .num').first()).toHaveText(
      String(answerKey.needsReached),
    );
    expect(crashes).toEqual([]);
  });
});

test.describe("addresses that do not make sense", () => {
  test("invalid settings fall back to the defaults or the nearest allowed value", async ({
    page,
  }) => {
    const crashes = watchCrashes(page);
    await page.goto(
      "/lab?calls=many&min=1000&week=1999-w01&ai=always&order=random&view=bogus&show=chart&case=..%2Fetc",
    );
    await waitForSql(page);
    await expect(page.getByLabel("Sales calls this week")).toHaveValue(
      String(DEFAULT_SETTINGS.capacity),
    );
    await expect(page.getByLabel("Score threshold")).toHaveValue(String(LIMITS.threshold.max));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const { metrics } = expectedMetrics({ threshold: LIMITS.threshold.max });
    expect(await metricValue(page, "needsReached")).toBe(String(metrics.needsReached));
    expect(crashes).toEqual([]);
  });

  test("a case file that does not exist leaves the lab as it was", async ({ page }) => {
    const crashes = watchCrashes(page);
    await page.goto("/lab?case=L-999999");
    await waitForSql(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const { metrics } = expectedMetrics();
    expect(await metricValue(page, "needsReached")).toBe(String(metrics.needsReached));
    expect(crashes).toEqual([]);
  });
});

test.describe("privacy and layout", () => {
  test.skip(({ isMobile }) => isMobile, "Checked once, on desktop.");

  const PAGES = ["/", "/work", "/about", "/architecture", "/colophon", "/lab"];

  test("no page contacts another site, sets a cookie or stores anything", async ({
    page,
    context,
    baseURL,
  }) => {
    const elsewhere: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(String(baseURL)) && !/^(data|blob):/.test(url)) elsewhere.push(url);
    });
    for (const path of PAGES) {
      await page.goto(path);
      if (path === "/lab") {
        await waitForSql(page);
        // Use the lab the way a visitor would: move a dial, open a case, switch views.
        await page.getByLabel("Sales calls this week").focus();
        await page.keyboard.press("ArrowRight");
        await page.goto("/lab?case=L-0001&view=hood");
        await expect(page.getByRole("dialog")).toBeVisible();
      }
      await page.waitForLoadState("networkidle");
    }
    expect(elsewhere).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    const stored = await page.evaluate(() => [
      ...Object.keys(localStorage),
      ...Object.keys(sessionStorage),
    ]);
    expect(stored).toEqual([]);
  });

  test("nothing scrolls sideways at 320 pixels wide", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    for (const path of [...PAGES, "/lab?view=hood", "/lab?show=table", "/lab?case=L-0001"]) {
      await page.goto(path);
      if (path.startsWith("/lab")) await waitForSql(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
