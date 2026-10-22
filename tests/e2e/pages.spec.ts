import { expect, test } from "@playwright/test";
import {
  expectedMetrics,
  expectNoAxeViolations,
  storedRun,
  waitForSql,
  watchErrors,
} from "./helpers";

const PAGES = ["/", "/lab", "/work", "/about", "/architecture", "/colophon"];

for (const path of PAGES) {
  test(`${path} loads with one main heading, no errors and no WCAG violations`, async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    if (path === "/lab") await waitForSql(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });
}

test("every internal link points to a page that exists", async ({ page, request }) => {
  const targets = new Set<string>();
  for (const path of PAGES) {
    await page.goto(path);
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    for (const href of hrefs) targets.add(href.split("#")[0] || "/");
  }
  expect(targets.size).toBeGreaterThan(5);
  for (const target of targets) {
    const response = await request.get(target);
    expect(response.status(), target).toBe(200);
  }
});

test("in-page links point to anchors that exist", async ({ page }) => {
  for (const path of ["/architecture", "/about", "/colophon"]) {
    await page.goto(path);
    const anchors = await page
      .locator('a[href^="#"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")?.slice(1) ?? ""));
    for (const id of anchors) {
      await expect(page.locator(`[id="${id}"]`), `${path}#${id}`).toHaveCount(1);
    }
  }
});

test("unknown addresses return 404 with a way back", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page does not exist");
  await expect(page.getByRole("main").getByRole("link", { name: "Decision Lab" })).toBeVisible();
});

test("the skip link moves focus to the main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard navigation is tested on desktop.");
  await page.goto("/work");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("the home page marks are the engine's output, not an illustration", async ({ page }) => {
  await page.goto("/");
  const figure = page.getByRole("img", { name: /leads/ });
  await expect(figure).toBeVisible();
  await expect(page.getByText(/Real output, not an illustration/)).toBeVisible();
});

test("the home page names the current role and labels the work result as program-level", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/^Office of the CEO Analyst at BairesDev since/)).toBeVisible();
  const results = page.getByRole("list", { name: "Results" });
  await expect(results).toContainText("Program-level result");
  await expect(results).toContainText("A result of the whole program, not mine alone.");
});

test("the home page states the lab's result as the engine computes it", async ({ page }) => {
  test.skip(!storedRun(), "No stored model run for the default week.");
  const rules = expectedMetrics({ aiPolicy: "off" }).metrics;
  const ai = expectedMetrics({ aiPolicy: "high" }).metrics;
  await page.goto("/");
  const results = page.getByRole("list", { name: "Results" });
  await expect(results).toContainText(
    `${ai.callsWithNeed} of ${ai.callsMade} sales calls find a real need`,
  );
  await expect(results).toContainText(`up from ${rules.callsWithNeed} with rules alone`);
  await expect(results).toContainText("The company and its data are made up.");
});

test("security headers are sent", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("connect-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test.describe("in dark mode", () => {
  test.use({ colorScheme: "dark" });
  test.skip(({ isMobile }) => isMobile, "Dark mode is checked once, on desktop.");

  for (const path of [...PAGES, "/lab?show=table", "/lab?view=hood"]) {
    test(`${path} has no WCAG violations`, async ({ page }) => {
      await page.goto(path);
      if (path.startsWith("/lab")) await waitForSql(page);
      await expectNoAxeViolations(page);
    });
  }
});

test("the lab's table view has no WCAG violations", async ({ page }) => {
  await page.goto("/lab?show=table");
  await waitForSql(page);
  await expect(page.getByRole("table").first()).toBeVisible();
  await expectNoAxeViolations(page);
});
