import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { indexAiRun } from "../../core/ai/outputs";
import type { AiRunFile } from "../../core/ai/schema";
import type { LeadAiSignals } from "../../core/ai/signals";
import { indexLabels } from "../../core/backtest/metrics";
import { answerKeySignals, runBacktest } from "../../core/backtest/run";
import { prepareWeek } from "../../core/cleaning/pipeline";
import type { LabelsFile, LeadsFile } from "../../core/data/files";
import { DEFAULT_SETTINGS, type LabSettings } from "../../core/settings";

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

function dataPath(path: string): string {
  return join(process.cwd(), "public", "data", path);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(dataPath(path), "utf8")) as T;
}

/**
 * The stored model run the lab uses for a week: null when there is none, or when it was made
 * for a different leads file, as in the lab.
 */
export function storedRun(week: string = DEFAULT_SETTINGS.week): AiRunFile | null {
  if (!existsSync(dataPath(`${week}/ai.json`))) return null;
  const run = readJson<AiRunFile>(`${week}/ai.json`);
  const leadsSha256 = createHash("sha256")
    .update(readFileSync(dataPath(`${week}/leads.json`), "utf8"))
    .digest("hex");
  return run.leadsSha256 === leadsSha256 ? run : null;
}

/** What the engine computes for these settings, to compare with what the page shows. */
export function expectedMetrics(overrides: Partial<LabSettings> = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  const leads = readJson<LeadsFile>(`${settings.week}/leads.json`);
  const labels = readJson<LabelsFile>(`${settings.week}/labels.json`);
  const prepared = prepareWeek(leads);
  const index = indexLabels(labels, prepared.leads);
  const run = settings.extraction === "model" ? storedRun(settings.week) : null;
  const ai: Map<string, LeadAiSignals> =
    settings.extraction === "answer_key"
      ? answerKeySignals(prepared, labels)
      : run
        ? indexAiRun(run, prepared.leads).byLead
        : new Map();
  // As in the lab, AI stays off when there is no stored run to read.
  const effective =
    settings.extraction === "model" && !run ? { ...settings, aiPolicy: "off" as const } : settings;
  return runBacktest(prepared, ai, index, effective);
}

/** Waits until the metrics on screen come from SQLite rather than the reference code. */
export async function waitForSql(page: Page): Promise<void> {
  await expect(page.getByText(/Computed by SQLite in your browser/)).toBeVisible({
    timeout: 20_000,
  });
}

export async function metricValue(page: Page, id: string): Promise<string> {
  return (await page.locator(`[data-metric="${id}"] .num`).first().innerText()).trim();
}
