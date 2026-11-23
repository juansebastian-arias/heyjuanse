import { expect, test } from "@playwright/test";
import { LEVERS, STATIONS, TODAY, withExtra, withLever } from "@/core/flow/company";
import { isClear } from "@/core/flow/experiment";
import { moveStation } from "@/core/flow/planner";
import { decodeScenario } from "@/core/flow/scenario";
import { count, money, signedMoney } from "@/lib/flow/format";
import { costText, moveName } from "@/lib/flow/words";
import {
  board,
  expectBoard,
  expectSoFar,
  figure,
  floor,
  moveBar,
  nextBar,
  nextMove,
  outcomeFor,
  plan,
  planned,
  settled,
  soFarLine,
  watchErrors,
} from "./helpers";

const ROUTING = withLever(TODAY, "routing", true);

test.describe("the first screen", () => {
  test("says what this is and offers one thing to do, without scrolling", async ({
    page,
  }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Find where this company loses its customers. Then fix it.",
    );
    await expect(page).toHaveTitle(/Juan Sebastián Arias/);
    // The one thing to do is whole on the first screen, on a desktop and on a phone.
    await expect(moveBar(page)).toBeInViewport({ ratio: 1 });
    await expect(moveBar(page).getByRole("button", { name: "Make this change" })).toBeVisible();
    // Nothing has been changed yet, so there is nothing to report.
    await expect(soFarLine(page)).toBeEmpty();
    // A reader who never scrolls still sees the company it acts on.
    await expect(floor(page)).toBeInViewport();
    if (testInfo.project.name === "desktop") {
      await expect(floor(page).getByRole("button", { name: /^Reply/ })).toBeInViewport({
        ratio: 1,
      });
    }
    // It is honest about being made up before anything else is said.
    await expect(page.getByText("A made-up company · a working simulation")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("fits the move and the company on a short laptop screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a laptop is not a phone");
    // What is left of a 1366 by 768 screen once the browser has taken its share.
    await page.setViewportSize({ width: 1366, height: 650 });
    await page.goto("/");
    await expect(moveBar(page)).toBeInViewport({ ratio: 1 });
    // The teams and the people at their desks, where requests can be seen moving.
    const reply = floor(page).getByRole("button", { name: /^Reply/ });
    await expect(reply).toBeInViewport({ ratio: 0.6 });
    // The result of the first change is reported where the visitor has just clicked.
    await moveBar(page).getByRole("button", { name: "Make this change" }).click();
    await settled(page);
    await expect(soFarLine(page)).toBeInViewport({ ratio: 1 });
    await expectSoFar(page, "1 change", outcomeFor(ROUTING), outcomeFor(TODAY).now);
  });

  test("arrives with its numbers: nothing to wait for before reading it", async ({ browser }) => {
    // Without scripts the page is only what the server sent.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const today = outcomeFor(TODAY);
    await expect(figure(page, "Sales collected a month").locator("dd > span").first()).toHaveText(
      money(today.now.totals.cash.mean),
    );
    await expect(moveBar(page)).toContainText(LEVERS.routing.name);
    await context.close();
  });

  test("shows the engine's own figures for today's company", async ({ page }) => {
    await page.goto("/");
    const today = outcomeFor(TODAY);
    await expectBoard(page, today, null);
    // The sentence at the top, the scoreboard and the team's panel are the same measurement.
    const lost = count(today.now.totals.lostBuyers.mean);
    const lede = page.locator("header").filter({ hasText: "A made-up company" });
    await expect(lede.locator("strong")).toHaveText(`${lost} companies a month`);
    await expect(lede).toContainText(
      `As it runs today it collects about ${money(today.now.totals.cash.mean)} a month`,
    );
    const best = nextMove(TODAY);
    if (!best) throw new Error("the model has a first move from today's company");
    await expect(moveBar(page)).toContainText(moveName(best.move));
    await expect(moveBar(page)).toContainText(`at ${STATIONS[moveStation(best.move)].name}`);
    await expect(moveBar(page)).toContainText(
      `About ${signedMoney(best.cash.mean)} a month in sales collected, for ${costText(best.monthly, best.build)}.`,
    );
  });
});

test.describe("the floor", () => {
  test("runs: the clock moves, requests are drawn, and it can be paused and skipped ahead", async ({
    page,
  }) => {
    await page.goto("/");
    const clock = floor(page).locator("p").first();
    await expect(clock).toContainText("week 11");
    const opening = await clock.textContent();
    await expect(clock).not.toHaveText(opening ?? "");

    // The drawing is really drawn: the canvas holds more than a blank sheet.
    const painted = await floor(page)
      .locator("canvas")
      .evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext("2d");
        if (!context) return 0;
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let inked = 0;
        for (let index = 3; index < data.length; index += 4) if ((data[index] ?? 0) > 0) inked++;
        return inked;
      });
    expect(painted).toBeGreaterThan(500);

    await floor(page).getByRole("button", { name: "Pause" }).click();
    const play = floor(page).getByRole("button", { name: "Play" });
    await expect(play).toHaveAttribute("aria-pressed", "true");
    // The clock on screen is refreshed four times a second, so give it one refresh to catch up.
    await page.waitForTimeout(400);
    const stopped = await clock.textContent();
    await page.waitForTimeout(700);
    expect(await clock.textContent()).toBe(stopped);

    // Twenty working days later it is the same weekday, four weeks on.
    await floor(page).getByRole("button", { name: "Skip 4 weeks" }).click();
    await expect(clock).toContainText("week 15");
    await expect(floor(page)).toContainText("gave up");
  });

  test("stands still for a visitor who asked for less motion, and still shows the change", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const clock = floor(page).locator("p").first();
    await expect(floor(page).getByRole("button", { name: "Play" })).toBeVisible();
    await expect(clock).toContainText("Tue 10:30");
    await page.waitForTimeout(600);
    await expect(clock).toContainText("Tue 10:30");
    await moveBar(page).getByRole("button", { name: "Make this change" }).click();
    // The four weeks after the change are one jump, not an animation.
    await expect(clock).toContainText("week 15");
    await settled(page);
    await expectBoard(page, outcomeFor(ROUTING), outcomeFor(TODAY).now);
  });

  test("opens a team when it is picked on the drawing", async ({ page }) => {
    await page.goto("/");
    await floor(page)
      .getByRole("button", { name: /^Quote/ })
      .click();
    await expect(page.locator("#station-title")).toContainText("Quote");
    await expect(page.locator("#station-title")).toContainText("Account executives · 4 people");
    await expect(floor(page).getByRole("button", { name: /^Quote/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("making a change", () => {
  test("the best move: the address, the floor and every figure follow, and it can be undone", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    const today = outcomeFor(TODAY);
    await moveBar(page).getByRole("button", { name: "Make this change" }).click();
    await expect(page).toHaveURL(/\/\?on=routing$/);
    await settled(page);

    const expected = outcomeFor(ROUTING);
    await expectBoard(page, expected, today.now);
    // The console says what the change came to, in the engine's own figures.
    await expectSoFar(page, "1 change", expected, today.now);
    const cash = expected.delta.cash;
    await expect(figure(page, "Sales collected a month")).toContainText(
      isClear(cash) ? signedMoney(cash.mean) : "no clear change",
    );

    // The floor restarts its count and says so; the plan records the change.
    await expect(floor(page)).toContainText("since your last change");
    await expect(plan(page)).toContainText(LEVERS.routing.name);

    // The model looked again from the new company, and the flag moved to where it now points.
    await planned(page);
    const next = nextMove(ROUTING);
    if (!next) throw new Error("the model has a second move");
    await expect(moveBar(page)).toContainText(moveName(next.move));
    await expect(floor(page).locator("button[data-flagged]")).toContainText(
      STATIONS[moveStation(next.move)].name,
    );
    await expect(page.locator("#station-title")).toContainText(
      STATIONS[moveStation(next.move)].name,
    );

    await plan(page)
      .getByRole("button", { name: `Undo: ${LEVERS.routing.name}` })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await settled(page);
    await expectBoard(page, today, null);
    await expect(soFarLine(page)).toBeEmpty();
    expect(errors).toEqual([]);
  });

  test("any other change can be tried: a hire shows up in the address and in the team", async ({
    page,
  }) => {
    await page.goto("/");
    await floor(page)
      .getByRole("button", { name: /^Quote/ })
      .click();
    const hire = page.locator("li").filter({ hasText: "Hire an account executive" });
    await hire.getByRole("button", { name: "Try it" }).click();
    await expect(page).toHaveURL(/\/\?hire=quote:1$/);
    await settled(page);
    const hired = outcomeFor(withExtra(TODAY, "quote", 1));
    await expectBoard(page, hired, outcomeFor(TODAY).now);
    await expectSoFar(page, "1 hire", hired, outcomeFor(TODAY).now);
    await expect(page.locator("#station-title")).toContainText("5 people");
    await expect(plan(page)).toContainText("1 more account executive hired");
    await plan(page).getByRole("button", { name: "Start over" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the whole plan at once ends where nothing else is clearly worth its cost", async ({
    page,
  }) => {
    await page.goto("/");
    const today = outcomeFor(TODAY);
    await plan(page)
      .getByRole("button", { name: /^Make all \d+ changes$/ })
      .click();
    await expect(page).toHaveURL(/\?on=/);
    await settled(page);
    // Whatever the plan was, the page must show the engine's figures for where it ended.
    const { setup } = decodeScenario(new URL(page.url()).search);
    expect(setup.on.length).toBeGreaterThan(2);
    const expected = outcomeFor(setup);
    await expectBoard(page, expected, today.now);
    await expect(nextBar(page)).toHaveAttribute("data-state", "done");
    await expect(nextBar(page)).toContainText("Nothing else is clearly worth its cost.");
    await expect(soFarLine(page)).toContainText(
      `${money(expected.now.totals.cash.mean)} a month instead of ${money(today.now.totals.cash.mean)}`,
    );
    await nextBar(page).getByRole("button", { name: "Start over" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(moveBar(page)).toContainText(LEVERS.routing.name);
  });

  test("works from the keyboard alone", async ({ page }) => {
    await page.goto("/");
    const button = moveBar(page).getByRole("button", { name: "Make this change" });
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/\?on=routing$/);
    await settled(page);
    await expect(board(page)).toContainText("was");
  });
});

test.describe("a link to a setup", () => {
  test("opens the same company, with its changes and its assumptions", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?on=routing&hire=quote:1&if=demand:16");
    await settled(page);
    const tweaks = { demand: 16 };
    const setup = withExtra(ROUTING, "quote", 1);
    await expectBoard(page, outcomeFor(setup, tweaks), outcomeFor(TODAY, tweaks).now);
    await expect(plan(page)).toContainText(LEVERS.routing.name);
    await expect(plan(page)).toContainText("1 more account executive hired");
    // The floor was started as that company, so its counts are not a restart.
    await expect(floor(page)).not.toContainText("since your last change");
    expect(errors).toEqual([]);
  });

  test("drops whatever it does not understand", async ({ page }) => {
    const errors = watchErrors(page);
    const query = "?on=bogus,routing,<script>&hire=quote:99,nobody:2,reply:x&if=demand:abc,price:";
    await page.goto(`/${query}`);
    await settled(page);
    const { setup, tweaks } = decodeScenario(query);
    expect(setup.on).toEqual(["routing"]);
    await expectBoard(page, outcomeFor(setup, tweaks), outcomeFor(TODAY, tweaks).now);
    expect(errors).toEqual([]);
  });
});

test.describe("where background workers are not available", () => {
  test("the simulation runs on the page itself and gives the same figures", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "Worker", { value: undefined });
    });
    const errors = watchErrors(page);
    await page.goto("/");
    await moveBar(page).getByRole("button", { name: "Make this change" }).click();
    await expect(page).toHaveURL(/\/\?on=routing$/);
    await settled(page);
    expect(page.workers()).toHaveLength(0);
    await expectBoard(page, outcomeFor(ROUTING), outcomeFor(TODAY).now);
    expect(errors).toEqual([]);
  });
});
