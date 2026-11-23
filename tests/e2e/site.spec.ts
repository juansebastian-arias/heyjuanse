import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, moveBar, openTab, planned, settled, watchErrors } from "./helpers";

const TABS = [
  "Why the line forms",
  "Follow one customer",
  "Change the assumptions",
  "Check the math",
  "Try the AI step",
];

test.describe("accessibility", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`the company has no detectable problems, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await planned(page);
      await expectNoAxeViolations(page);
    });

    test(`how it is built has no detectable problems, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/engine");
      await expectNoAxeViolations(page);
    });
  }

  test("a changed company and every layer under it have no detectable problems", async ({
    page,
  }) => {
    test.slow();
    await page.goto("/");
    await moveBar(page).getByRole("button", { name: "Make this change" }).click();
    await planned(page);
    await expectNoAxeViolations(page);
    for (const name of TABS) {
      const panel = await openTab(page, name);
      if (name === "Check the math") {
        await panel.getByRole("button", { name: "Run the checks" }).click();
        await expect(panel.getByRole("table")).toBeVisible({ timeout: 60_000 });
      }
      if (name === "Try the AI step") {
        await panel.getByRole("button", { name: "Let the agent handle it" }).click();
        await expect(panel.getByRole("article", { name: "What the agent did" })).toBeVisible();
      }
      await expectNoAxeViolations(page, "#inside");
    }
  });

  test("the page that is not there has no detectable problems", async ({ page }) => {
    await page.goto("/no-such-page");
    await expectNoAxeViolations(page);
  });

  test("the first stop of the keyboard skips to the content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });
});

test.describe("small screens", () => {
  for (const path of ["/", "/engine", "/no-such-page"]) {
    test(`${path} never scrolls sideways at 320 pixels`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      const overflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
      expect(await overflow()).toBeLessThanOrEqual(0);
      if (path !== "/") return;
      // Nor after a change, nor with any of the layers open.
      await moveBar(page).getByRole("button", { name: "Make this change" }).click();
      await settled(page);
      expect(await overflow()).toBeLessThanOrEqual(0);
      for (const name of TABS) {
        await openTab(page, name);
        expect(await overflow(), name).toBeLessThanOrEqual(0);
      }
    });
  }

  test("every layer can be seen to exist without scrolling a row of tabs", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await page.goto("/");
    await page.getByRole("tablist").scrollIntoViewIfNeeded();
    for (const name of TABS) {
      await expect(page.getByRole("tab", { name })).toBeInViewport({ ratio: 1 });
    }
  });
});

test.describe("keeping to itself", () => {
  test("a whole visit sets no cookie, stores nothing and contacts no other site", async ({
    page,
    context,
    baseURL,
  }) => {
    test.slow();
    const origin = new URL(baseURL ?? "").origin;
    const elsewhere: string[] = [];
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.origin !== origin) elsewhere.push(request.url());
    });
    const errors = watchErrors(page);

    await page.goto("/");
    await moveBar(page).getByRole("button", { name: "Make this change" }).click();
    await planned(page);
    for (const name of TABS) await openTab(page, name);
    const agent = page.getByRole("tabpanel", { name: "Try the AI step" });
    await agent.getByRole("button", { name: "Let the agent handle it" }).click();
    await expect(agent.getByRole("article", { name: "What the agent did" })).toBeVisible();
    await page.getByRole("link", { name: "How it is built" }).first().click();
    await expect(page).toHaveURL(/\/engine$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The model behind the page");

    expect(elsewhere).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    const stored = await page.evaluate(() => [localStorage.length, sessionStorage.length]);
    expect(stored).toEqual([0, 0]);
    expect(errors).toEqual([]);
  });

  test("links that leave the site say where they go and open nothing behind the visitor's back", async ({
    page,
  }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(contact.getByRole("link", { name: /@/ })).toHaveAttribute("href", /^mailto:/);
    await expect(contact.getByRole("link", { name: /linkedin\.com/ })).toHaveAttribute(
      "href",
      /^https:\/\/www\.linkedin\.com\/in\//,
    );
    await expect(contact.getByRole("link", { name: /github\.com/ })).toHaveAttribute(
      "href",
      /^https:\/\/github\.com\//,
    );
    // Nothing on either page says its author is looking for work.
    for (const path of ["/", "/engine"]) {
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText(
        /hire me|open to work|looking for (a )?(job|work|role)|available for hire/i,
      );
    }
  });
});

test.describe("the server", () => {
  test("sends the security headers with every page", async ({ request }) => {
    for (const path of ["/", "/engine"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      const policy = headers["content-security-policy"] ?? "";
      for (const part of [
        "default-src 'self'",
        "worker-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ]) {
        expect(policy, `${path}: ${part}`).toContain(part);
      }
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["strict-transport-security"]).toContain("max-age=");
      expect(headers["permissions-policy"]).toContain("camera=()");
    }
  });

  test("sends the addresses of the old site to the new one", async ({ request }) => {
    const moved: Array<[string, string]> = [
      ["/work", "/"],
      ["/about", "/"],
      ["/simulator", "/"],
      ["/lab", "/"],
      ["/architecture", "/engine"],
      ["/colophon", "/engine"],
    ];
    for (const [from, to] of moved) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(307);
      expect(new URL(response.headers().location ?? "", "http://x").pathname, from).toBe(to);
    }
  });

  test("answers an address that does not exist with a 404 and a way back", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page does not exist");
    await page.getByRole("main").getByRole("link", { name: "The company" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("never ships the model's key or its client to the browser", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (response) => {
      const type = response.headers()["content-type"] ?? "";
      if (!type.includes("javascript")) return;
      scripts.push(await response.text().catch(() => ""));
    });
    await page.goto("/");
    await openTab(page, "Try the AI step");
    await page.waitForLoadState("networkidle");
    expect(scripts.length).toBeGreaterThan(3);
    for (const script of scripts) {
      expect(script).not.toContain("ANTHROPIC_API_KEY");
      expect(script).not.toContain("api.anthropic.com");
      expect(script).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/);
    }
  });
});

test.describe("the live agent's route", () => {
  // These requests stop at the route's first two checks, so none of them can reach the model.
  test("refuses a request that does not come from this site", async ({ request }) => {
    const message = "We run 40 vans from one depot. Can we see a demo next week?";
    const none = await request.post("/api/agent", { data: { message } });
    expect(none.status()).toBe(403);
    const other = await request.post("/api/agent", {
      data: { message },
      headers: { origin: "https://example.com" },
    });
    expect(other.status()).toBe(403);
    expect(await other.json()).toMatchObject({ ok: false, error: "forbidden" });
  });

  test("answers its own page with a plain reason when it cannot run", async ({
    request,
    baseURL,
  }) => {
    // Too short to be accepted, so even with a key configured nothing is sent to the model.
    const response = await request.post("/api/agent", {
      data: { message: "hi" },
      headers: { origin: baseURL ?? "" },
    });
    const body = (await response.json()) as { ok: boolean; error: string; message: string };
    expect(body.ok).toBe(false);
    expect(["offline", "invalid"]).toContain(body.error);
    expect([400, 503]).toContain(response.status());
    expect(body.message.length).toBeGreaterThan(10);
  });

  test("only answers POST", async ({ request }) => {
    const response = await request.get("/api/agent");
    expect(response.status()).toBe(405);
  });
});
