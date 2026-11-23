import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, waitForSql, watchErrors } from "./helpers";

const recordings = JSON.parse(readFileSync("content/agent/recordings.json", "utf8")) as {
  recordedAt: string | null;
};

const PAGES = ["/", "/lab", "/about", "/architecture", "/colophon"];

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
  await page.goto("/about");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("the home page says the role and the result in the first screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "turn leads into sales meetings",
  );
  await expect(page.getByText("GTM engineer", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("table", { name: /inbound leads/ })).toBeVisible();
});

test("the simulator recommends a move, and applying it adds meetings", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/#simulator");
  const meetings = page.locator("#simulator dl dd").first();
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

test("the 90-day project opens computed and follows the visitor's numbers", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/#project");
  const project = page.locator("#project");
  const phases = project.getByRole("list", { name: "Your 90-day project" }).locator(":scope > li");
  await expect(phases).toHaveCount(3);
  await expect(project.getByText(/By day 90: about/)).toBeVisible();
  await project.getByRole("spinbutton", { name: "Reps on new leads" }).fill("5");
  await project.getByRole("button", { name: "Recalculate with my numbers" }).click();
  await expect(project.getByText(/with the same 5 reps/)).toBeVisible();
  await expectNoAxeViolations(page, "#project");
  expect(errors).toEqual([]);
});

test("the retired work page sends old links to About", async ({ page }) => {
  await page.goto("/work");
  await expect(page).toHaveURL(/\/about$/);
});

test("the agent handles a sample lead and a person approves the draft", async ({ page }) => {
  test.skip(!recordings.recordedAt, "No recorded runs yet");
  const errors = watchErrors(page);
  await page.goto("/#agent");
  await page.getByRole("button", { name: /Danielle Okafor/ }).click();
  await page.getByRole("button", { name: "Let the agent handle it" }).click();
  await expect(page.getByText("Routed to")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("region", { name: "Approval log" })).toContainText("Danielle Okafor");
  await expectNoAxeViolations(page, "#agent");
  expect(errors).toEqual([]);
});

test("a lead the visitor writes fails gracefully when the live agent is off", async ({ page }) => {
  // The test server has no API key, so the route answers that the agent is switched off.
  await page.goto("/#agent");
  await page.getByRole("button", { name: /Write your own lead/ }).click();
  await page
    .locator("#agent")
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("We have 30 reps on Salesforce. Can we see a demo next week?");
  await page.getByRole("button", { name: "Run the agent live" }).click();
  await expect(
    page.getByText("The live agent is switched off right now.", { exact: false }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "#agent");
});

test("the agent route refuses requests from other sites", async ({ request }) => {
  const response = await request.post("/api/agent", {
    headers: { Origin: "https://elsewhere.example" },
    data: { message: "Can we see a demo next week, please?" },
  });
  expect(response.status()).toBe(403);
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
