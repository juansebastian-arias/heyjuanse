import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { type Setup, setupKey, TODAY } from "@/core/flow/company";
import { demands, type Projection, runMany, type Summary } from "@/core/flow/experiment";
import { type Evaluate, type Option, planFrom } from "@/core/flow/planner";
import { assumptionsFor, type Tweaks, tweaksKey } from "@/core/flow/scenario";
import { count, days, duration, money, signedMoney } from "@/lib/flow/format";
import { type Outcome, outcomeOf, RUNS } from "@/lib/flow/view";
import { soFar } from "@/lib/flow/words";

/** WCAG 2.2 A and AA, as checked by axe. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function expectNoAxeViolations(page: Page, include?: string): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

/** Collects page errors and console errors, ignoring nothing. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

// The model, asked directly. These tests run the same quarters the page simulates, in their own
// process and without the page, and then hold the page to those numbers.

const engines = new Map<string, Evaluate>();

/** Simulated quarters for a setup under a set of assumptions, each setup simulated once. */
export function engine(tweaks: Tweaks = {}): Evaluate {
  const key = tweaksKey(tweaks);
  const known = engines.get(key);
  if (known) return known;
  const a = assumptionsFor(tweaks);
  const streams = demands(RUNS, a);
  const cache = new Map<string, Summary[]>();
  const evaluate: Evaluate = (setup) => {
    const id = setupKey(setup);
    let runs = cache.get(id);
    if (!runs) {
      runs = runMany(setup, streams, a);
      cache.set(id, runs);
    }
    return runs;
  };
  engines.set(key, evaluate);
  return evaluate;
}

/** What the page should show for a setup: it, measured against today's company. */
export function outcomeFor(setup: Setup, tweaks: Tweaks = {}): Outcome {
  const evaluate = engine(tweaks);
  return outcomeOf(setup, evaluate(TODAY), evaluate(setup), assumptionsFor(tweaks));
}

/** The planner's next move from a setup, or null when nothing is clearly worth its cost. */
export function nextMove(setup: Setup, tweaks: Tweaks = {}): Option | null {
  return planFrom(setup, engine(tweaks), assumptionsFor(tweaks), 1)[0] ?? null;
}

// The page.

export const floor = (page: Page) => page.getByRole("region", { name: "Larkspur, running" });
export const board = (page: Page) => page.getByRole("region", { name: "What a month adds up to" });
export const plan = (page: Page) =>
  page.getByRole("complementary", { name: "Your changes and the plan" });
/** The page's console: what the changes so far came to, and the move to make next. */
export const nextBar = (page: Page) => page.getByRole("region", { name: "The next move" });
/** The console while it has a move to offer. */
export const moveBar = (page: Page) => page.locator('section[data-state="move"]');
/** The sentence that reports what the changes so far came to. Empty for today's company. */
export const soFarLine = (page: Page) => nextBar(page).getByRole("status");

/** One figure of the scoreboard, found by its label. */
export function figure(page: Page, label: string): Locator {
  return board(page)
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: label }) });
}

/** Waits until the figures on screen belong to the setup in the address bar. */
export async function settled(page: Page): Promise<void> {
  await expect(board(page)).toBeVisible();
  await expect(board(page)).not.toHaveAttribute("data-busy", /.*/);
}

/** Waits until the page has also worked out what to do next from here. */
export async function planned(page: Page): Promise<void> {
  await settled(page);
  await expect(nextBar(page)).not.toHaveAttribute("data-state", "working");
}

/**
 * Holds the sentence in the console to an outcome computed by the engine: it names a figure only
 * when that figure clearly moved, and then with the engine's own numbers.
 */
export async function expectSoFar(
  page: Page,
  changes: string,
  expected: Outcome,
  today: Projection,
): Promise<void> {
  const line = soFarLine(page);
  const { cash, lost } = soFar(
    { cash: today.totals.cash.mean, lostBuyers: today.totals.lostBuyers.mean },
    { cash: expected.now.totals.cash.mean, lostBuyers: expected.now.totals.lostBuyers.mean },
    expected.delta,
  );
  await expect(line).toContainText(`With ${changes}, `);
  if (cash) {
    await expect(line).toContainText(`collects about ${cash.now} a month instead of ${cash.was}`);
  } else {
    await expect(line).not.toContainText("collects about");
  }
  if (lost) {
    await expect(line).toContainText(
      `loses ${lost.now} ${lost.noun} a month to waiting instead of ${lost.was}`,
    );
  } else {
    await expect(line).not.toContainText("to waiting instead of");
  }
  // Sales that did not clearly move are said not to have moved.
  if (cash) await expect(line).not.toContainText("no clear change");
  else await expect(line).toContainText("no clear change");
}

/**
 * Holds the scoreboard to an outcome computed by the engine: the four figures, their ranges and,
 * for a changed setup, today's value next to each.
 */
export async function expectBoard(
  page: Page,
  expected: Outcome,
  today: Projection | null,
): Promise<void> {
  const { totals } = expected.now;
  const rows = [
    { label: "Sales collected a month", key: "cash", format: money },
    { label: "Buyers lost to waiting, a month", key: "lostBuyers", format: count },
    { label: "Average wait before a first reply", key: "replyWaitHours", format: duration },
    { label: "Typical time from request to cash", key: "cashDays", format: days },
  ] as const;
  for (const row of rows) {
    const estimate = totals[row.key];
    const cell = figure(page, row.label);
    await expect(cell.locator("dd > span").first()).toHaveText(row.format(estimate.mean));
    await expect(cell).toContainText(
      `${row.format(estimate.low)} to ${row.format(estimate.high)} in 8 of 10 quarters`,
    );
    if (today) await expect(cell).toContainText(`was ${row.format(today.totals[row.key].mean)}`);
    else await expect(cell).not.toContainText("was");
  }
  await expect(figure(page, "Buyers lost to waiting, a month")).toContainText(
    `worth ${money(totals.lostValue.mean)}`,
  );
  if (today) {
    await expect(board(page)).toContainText(
      `Larkspur keeps about ${signedMoney(expected.delta.net.mean)} more a month`,
    );
  }
}

/** Opens one of the layers under the main screen and returns its panel. */
export async function openTab(page: Page, name: string): Promise<Locator> {
  await page.getByRole("tab", { name }).click();
  const panel = page.getByRole("tabpanel", { name });
  await expect(panel).toBeVisible();
  return panel;
}
