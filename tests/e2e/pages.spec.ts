import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, waitForSql, watchErrors } from "./helpers";

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

test("the home page says the role and the result in the first screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "turns leads into sales meetings",
  );
  await expect(page.getByText("GTM engineer", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("table", { name: /inbound leads/ })).toBeVisible();
});

test("the simulator recommends a move, and applying it adds meetings", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/#simulator");
  const meetings = page.locator("dl dd").first();
  const before = Number((await meetings.textContent())?.replace(/\D/g, ""));
  await page.getByRole("button", { name: "Apply this decision" }).click();
  await expect(page.getByRole("list", { name: "Decisions applied" })).toBeVisible();
  const after = Number((await meetings.textContent())?.replace(/\D/g, ""));
  expect(after).toBeGreaterThan(before);
  await page.getByRole("radio", { name: /Product-led/ }).check();
  await expect(page.getByRole("list", { name: "Decisions applied" })).toHaveCount(0);
  await expectNoAxeViolations(page, "#simulator");
  expect(errors).toEqual([]);
});

test("following the data to the end stacks up decisions until none is left", async ({ page }) => {
  await page.goto("/#simulator");
  await page.getByRole("button", { name: "Follow the data to the end" }).click();
  await expect(page.getByText("No single switch adds more meetings from here.")).toBeVisible({
    timeout: 15_000,
  });
  const steps = page.getByRole("list", { name: "Decisions applied" }).getByRole("listitem");
  expect(await steps.count()).toBeGreaterThan(3);
  await expectNoAxeViolations(page, "#simulator");
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
