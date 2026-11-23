import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { OWNERS, SAMPLE_LEADS } from "@/content/agent/leads";
import type { Recordings } from "@/content/agent/recordings";
import { BASE, STATION_IDS, STATIONS, TODAY, withLever } from "@/core/flow/company";
import { TWEAK_IDS, TWEAKS } from "@/core/flow/scenario";
import { count, duration } from "@/lib/flow/format";
import { followedBuyers, MOMENTS } from "@/lib/flow/story";
import { expectBoard, moveBar, openTab, outcomeFor, settled, watchErrors } from "./helpers";

const TAB = {
  why: "Why the line forms",
  customer: "Follow one customer",
  assumptions: "Change the assumptions",
  checks: "Check the math",
  ai: "Try the AI step",
} as const;
const TABS: string[] = Object.values(TAB);
const ROUTING = withLever(TODAY, "routing", true);

/** The agent's recorded runs, read as data: the test never calls the model. */
const RECORDINGS = JSON.parse(
  readFileSync(join(process.cwd(), "content", "agent", "recordings.json"), "utf8"),
) as Recordings;

async function makeBestChange(page: Page): Promise<void> {
  await moveBar(page).getByRole("button", { name: "Make this change" }).click();
  await expect(page).toHaveURL(/\/\?on=routing$/);
  await settled(page);
}

test.describe("the layers under the main screen", () => {
  test("are tabs, and work as tabs do from the keyboard", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tablist").getByRole("tab");
    await expect(tabs).toHaveText(TABS);
    const tab = (index: number) => page.getByRole("tab", { name: TABS[index] ?? "" });
    await tab(0).focus();
    await expect(tab(0)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(tab(1)).toBeFocused();
    await expect(tab(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: TAB.customer })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: TAB.why })).toBeHidden();
    await page.keyboard.press("End");
    await expect(tab(4)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab(0)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(4)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tab(0)).toHaveAttribute("aria-selected", "true");
    // Only the open tab is a stop for the Tab key; the arrows move between them.
    await expect(page.getByRole("tablist").locator('[tabindex="0"]')).toHaveCount(1);
  });
});

test.describe("why the line forms", () => {
  test("gives each team's measurements as text, the same ones the drawing shows", async ({
    page,
  }) => {
    await page.goto("/");
    const panel = page.getByRole("tabpanel", { name: TAB.why });
    const { now } = outcomeFor(TODAY);
    const rows = panel.locator("tbody tr");
    await expect(rows).toHaveCount(STATION_IDS.length);
    for (const [index, id] of STATION_IDS.entries()) {
      const station = now.stations[id];
      const cells = rows.nth(index).locator("td");
      await expect(rows.nth(index).locator("th")).toContainText(STATIONS[id].name);
      await expect(cells.nth(4)).toHaveText(duration(station.meanWaitHours.mean));
      await expect(cells.nth(5)).toHaveText(duration(station.assignHours.mean));
      await expect(cells.nth(8)).toHaveText(count(station.leftBuyers.mean));
    }
    // One number, three places: the table's total, the scoreboard and the sentence at the top.
    const lost = count(now.totals.lostBuyers.mean);
    await expect(panel.locator("tfoot td")).toHaveText(lost);
    await expect(page.getByRole("main").locator("header strong")).toContainText(lost);
  });

  test("puts today's value under each one that a change moved", async ({ page }) => {
    await page.goto("/");
    await makeBestChange(page);
    const panel = page.getByRole("tabpanel", { name: TAB.why });
    const today = outcomeFor(TODAY).now.stations.reply.meanWaitHours.mean;
    const routed = outcomeFor(ROUTING).now.stations.reply.meanWaitHours.mean;
    const wait = panel.locator("tbody tr").first().locator("td").nth(4);
    await expect(wait).toContainText(duration(routed));
    await expect(wait).toContainText(`${duration(today)} today`);
    expect(routed).toBeLessThan(today);
  });
});

test.describe("follow one customer", () => {
  test("tells one buyer's story, and the same buyer's story after a change", async ({ page }) => {
    await page.goto("/");
    const panel = await openTab(page, TAB.customer);
    const before = followedBuyers(TODAY);
    const lostToday = before.filter((pair) => pair.before.fate === "left").length;
    expect(lostToday).toBeGreaterThan(0);
    await expect(panel).toContainText(`These are the ${before.length} companies`);
    await expect(panel).toContainText(`Today ${lostToday} of them give up`);
    await expect(panel.getByRole("combobox", { name: "Customer" }).locator("option")).toHaveCount(
      before.length,
    );
    const table = panel.getByRole("table");
    await expect(table.locator("thead th")).toHaveCount(2);
    await expect(table.locator("tbody th")).toHaveText([...MOMENTS]);

    await makeBestChange(page);
    const after = followedBuyers(ROUTING);
    const kept = after.filter(
      (pair) => pair.before.fate === "left" && pair.after.fate === "paid",
    ).length;
    await expect(panel).toContainText(
      `with your changes, ${kept} of those ${lostToday} ${kept === 1 ? "becomes a customer" : "become customers"}`,
    );
    await expect(table.locator("thead th")).toHaveText([/vehicles$/, "Today", "With your changes"]);
    // It opens on a customer the change kept, when there is one: lost today, paid with it.
    if (kept > 0) {
      const foot = table.locator("tfoot td");
      await expect(foot.first()).toContainText("Gave up after");
      await expect(foot.last()).toContainText("Paid");
    }
    // Any other customer can be picked.
    const other = after[after.length - 1];
    if (!other) throw new Error("no customers to follow");
    await panel.getByRole("combobox", { name: "Customer" }).selectOption(String(other.request.id));
    await expect(table.locator("thead th").first()).toContainText(other.request.label);
  });
});

test.describe("change the assumptions", () => {
  test("simulates the whole company again with the visitor's number", async ({ page }) => {
    await page.goto("/");
    const panel = await openTab(page, TAB.assumptions);
    await expect(panel.getByRole("slider")).toHaveCount(TWEAK_IDS.length);
    const slider = panel.getByRole("slider", { name: TWEAKS.demand.label });
    const start = TWEAKS.demand.read(BASE);
    await expect(slider).toHaveValue(String(start));
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const value = Number(await slider.inputValue());
    expect(value).toBeGreaterThan(start);
    await expect(page).toHaveURL(new RegExp(`if=demand:${value}$`));
    await settled(page);
    await expectBoard(page, outcomeFor(TODAY, { demand: value }), null);
    await expect(panel).toContainText(`started at ${start}`);

    await panel.getByRole("button", { name: /^Put all/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await settled(page);
    await expectBoard(page, outcomeFor(TODAY), null);
  });

  test("measures how far the result leans on each assumption", async ({ page }) => {
    test.slow();
    await page.goto("/");
    const panel = await openTab(page, TAB.assumptions);
    await panel.getByRole("button", { name: "Test the assumptions" }).click();
    const rows = panel.locator("ol > li");
    await expect(rows).toHaveCount(TWEAK_IDS.length, { timeout: 90_000 });
    await expect(panel).toContainText("the whole plan minus today's company");
    // Every assumption is there once, with the result at a lower and a higher value.
    for (const id of TWEAK_IDS) await expect(panel.locator("ol")).toContainText(TWEAKS[id].label);
    await expect(rows.first()).toContainText("$");
    await expect(panel.getByRole("button", { name: "Run it again" })).toBeEnabled();
  });

  test("lists every other number the model takes as given", async ({ page }) => {
    await page.goto("/");
    const panel = await openTab(page, TAB.assumptions);
    await panel.getByText("Every other number the model takes as given").click();
    await expect(panel.getByRole("row", { name: /Requests on a weekday/ })).toContainText(
      String(BASE.requestsPerWeekday),
    );
  });
});

test.describe("check the math", () => {
  test("runs the engine against queues with known answers, in this browser", async ({ page }) => {
    await page.goto("/");
    const panel = await openTab(page, TAB.checks);
    await panel.getByRole("button", { name: "Run the checks" }).click();
    await expect(panel.getByText(/^\d+ of \d+ checks agree with the formulas/)).toBeVisible({
      timeout: 60_000,
    });
    const rows = panel.getByRole("table").locator("tbody tr");
    const total = await rows.count();
    expect(total).toBeGreaterThanOrEqual(7);
    await expect(panel).toContainText(`${total} of ${total} checks agree with the formulas`);
    for (let index = 0; index < total; index++) {
      await expect(rows.nth(index).locator("td").last()).toHaveText("Yes");
    }
    await expect(panel.getByRole("button", { name: "Run the checks again" })).toBeEnabled();
  });

  test("reports the tests that ran before this version was built", async ({ page }) => {
    await page.goto("/");
    const panel = await openTab(page, TAB.checks);
    const report = JSON.parse(
      readFileSync(join(process.cwd(), ".reports", "vitest.json"), "utf8"),
    ) as { numTotalTests: number; numPassedTests: number };
    expect(report.numPassedTests).toBe(report.numTotalTests);
    await expect(panel).toContainText(
      `${report.numPassedTests} of ${report.numTotalTests} automated tests passed`,
    );
  });
});

test.describe("try the AI step", () => {
  test("replays a recorded run, and a person approves the reply", async ({ page }) => {
    const errors = watchErrors(page);
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/")) calls.push(request.url());
    });
    await page.goto("/");
    const panel = await openTab(page, TAB.ai);
    const lead = SAMPLE_LEADS[0];
    if (!lead) throw new Error("no sample requests");
    const run = RECORDINGS.runs[lead.id];
    if (!run) throw new Error(`no recorded run for ${lead.id}`);
    await expect(panel.getByRole("button", { name: new RegExp(lead.name) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await panel.getByRole("button", { name: "Let the agent handle it" }).click();
    const result = panel.getByRole("article", { name: "What the agent did" });
    await expect(result).toBeVisible();
    await expect(result).toContainText(OWNERS[run.triage.route.owner].name);
    await expect(result.getByLabel("Subject")).toHaveValue(run.triage.reply.subject);
    await expect(result).toContainText("A recorded run of this agent");
    await expect(result).toContainText(run.model);

    // The person in the loop: edit the draft, approve it, and the log says a person edited it.
    await result.getByLabel("Subject").fill("Edited by the reviewer");
    await result.getByRole("button", { name: "Approve" }).click();
    await expect(result).toContainText("Approved and logged");
    await expect(result).toContainText("here nothing is sent");
    await expect(result.getByLabel("Subject")).toBeDisabled();
    const log = panel.getByRole("region", { name: "Approval log" });
    await expect(log).toContainText(`Approved: ${lead.name}`);
    await expect(log).toContainText("(edited by a person)");

    // A replay costs nothing: the page never called the server for it.
    expect(calls).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("has a recorded run for every sample request", async ({ page }) => {
    await page.goto("/");
    const panel = await openTab(page, TAB.ai);
    for (const lead of SAMPLE_LEADS) {
      const run = RECORDINGS.runs[lead.id];
      if (!run) throw new Error(`no recorded run for ${lead.id}`);
      await panel.getByRole("button", { name: new RegExp(lead.name) }).click();
      await panel.getByRole("button", { name: "Let the agent handle it" }).click();
      const result = panel.getByRole("article", { name: "What the agent did" });
      await expect(result).toContainText(OWNERS[run.triage.route.owner].name);
      await result.getByRole("button", { name: "Reject" }).click();
      await expect(result).toContainText("Rejected and logged");
    }
    await expect(panel.getByRole("region", { name: "Approval log" }).locator("li")).toHaveCount(
      SAMPLE_LEADS.length,
    );
  });

  test("says so plainly when the live agent cannot answer, and keeps working", async ({ page }) => {
    // The server's answer is stood in for here, so this test never reaches the model.
    await page.route("**/api/agent", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "offline",
          message: "The live agent is switched off right now.",
        }),
      }),
    );
    await page.goto("/");
    const panel = await openTab(page, TAB.ai);
    await panel.getByRole("button", { name: /Write your own request/ }).click();
    await panel.getByLabel("Message").fill("We run 40 vans from one depot. Can we see a demo?");
    await panel.getByRole("button", { name: "Run the agent live" }).click();
    await expect(panel).toContainText("The live agent is switched off right now.");
    // The samples still work after a failure.
    const lead = SAMPLE_LEADS[0];
    if (!lead) throw new Error("no sample requests");
    await panel.getByRole("button", { name: new RegExp(lead.name) }).click();
    await panel.getByRole("button", { name: "Let the agent handle it" }).click();
    await expect(panel.getByRole("article", { name: "What the agent did" })).toBeVisible();
  });

  test("survives a server that does not answer at all", async ({ page }) => {
    await page.route("**/api/agent", (route) => route.abort());
    await page.goto("/");
    const panel = await openTab(page, TAB.ai);
    await panel.getByRole("button", { name: /Write your own request/ }).click();
    await panel.getByLabel("Message").fill("We run 40 vans from one depot. Can we see a demo?");
    await panel.getByRole("button", { name: "Run the agent live" }).click();
    await expect(panel).toContainText("The agent could not be reached. Try again later.");
    await expect(panel.getByRole("button", { name: "Run the agent live" })).toBeEnabled();
  });
});
