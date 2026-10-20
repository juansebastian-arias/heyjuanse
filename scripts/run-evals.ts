/**
 * Scores the stored AI outputs against the answer key and prints a summary.
 *   pnpm ai:eval               plain text
 *   pnpm ai:eval --markdown    a Markdown table, used in the pull request that adds new outputs
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiRunFile } from "../core/ai/schema";
import {
  type AiScorecard,
  evaluateRun,
  SCORED_FIELD_LABELS,
  SCORED_FIELDS,
} from "../core/backtest/ai-eval";
import type { LabelsFile, LeadsFile, Manifest } from "../core/data/files";
import { DATA_DIR, sha256 } from "./generate-datasets";

const pct = (part: number, total: number) =>
  total === 0 ? "n/a" : `${((100 * part) / total).toFixed(1)}%`;

function rows(card: AiScorecard): Array<[string, string]> {
  return [
    ["Messages", String(card.messages)],
    [
      "Answers used",
      `${card.statuses.ok} (${card.statuses.refusal} refused, ${card.statuses.invalid_output + card.statuses.max_tokens + card.statuses.api_error} failed)`,
    ],
    ...SCORED_FIELDS.map((field): [string, string] => [
      SCORED_FIELD_LABELS[field],
      pct(card.fields[field].correct, card.fields[field].total),
    ]),
    [
      "All four routing fields right",
      pct(card.routingFieldsCorrect.correct, card.routingFieldsCorrect.total),
    ],
    ["Injection attempts caught", `${card.injection.caught} of ${card.injection.total}`],
    ["False injection alarms", String(card.injection.falseAlarms)],
    [
      "High confidence, routing fields right",
      pct(card.byConfidence.high.correct, card.byConfidence.high.total),
    ],
    ["Downgraded by the quote check", String(card.downgraded)],
    ["Estimated cost", `$${card.usage.estimatedCostUsd.toFixed(3)}`],
  ];
}

function main(): void {
  const markdown = process.argv.includes("--markdown");
  const manifest = JSON.parse(readFileSync(join(DATA_DIR, "manifest.json"), "utf8")) as Manifest;
  let found = 0;
  for (const week of manifest.weeks) {
    const aiPath = join(DATA_DIR, week.id, "ai.json");
    if (!existsSync(aiPath)) continue;
    found++;
    const leadsText = readFileSync(join(DATA_DIR, week.files.leads), "utf8");
    const run = JSON.parse(readFileSync(aiPath, "utf8")) as AiRunFile;
    const labels = JSON.parse(
      readFileSync(join(DATA_DIR, week.files.labels), "utf8"),
    ) as LabelsFile;
    const card = evaluateRun(run, labels, JSON.parse(leadsText) as LeadsFile);
    const stale = run.leadsSha256 !== sha256(leadsText);
    if (markdown) {
      console.info(`### ${week.label} (${run.model}, effort ${run.effort})\n`);
      console.info("| Measure | Result |\n| --- | --- |");
      for (const [name, value] of rows(card)) console.info(`| ${name} | ${value} |`);
      if (stale)
        console.info(
          "\n**Warning:** these outputs were made for a different version of the leads file.",
        );
      console.info("");
    } else {
      console.info(
        `${week.id} ${run.model} (effort ${run.effort}, prompt ${run.promptVersion})${stale ? "  STALE" : ""}`,
      );
      for (const [name, value] of rows(card)) console.info(`  ${name.padEnd(40)} ${value}`);
    }
  }
  if (found === 0)
    console.info("No stored AI outputs yet. Run the 'Generate AI outputs' workflow first.");
}

main();
