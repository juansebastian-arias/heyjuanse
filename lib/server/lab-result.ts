/**
 * The lab's result in one line, for the home page and the top of the lab: how many of the default
 * week's sales calls find a real need with the rules alone, and with the stored AI signals. It is
 * computed when the site is built, by the same engine and from the same files as the lab, so the
 * numbers match what a visitor sees after pressing "Use AI signals".
 */
import { indexAiRun } from "@/core/ai/outputs";
import { indexLabels } from "@/core/backtest/metrics";
import { runBacktest } from "@/core/backtest/run";
import { prepareWeek } from "@/core/cleaning/pipeline";
import { DEFAULT_SETTINGS } from "@/core/settings";
import { readCurrentAiRun, readWeek } from "./week-files";

export interface LabResult {
  weekLabel: string;
  /** Sales calls made, the same with and without AI: the week's call capacity is the limit. */
  calls: number;
  /** Calls that reached a person with a real need, with the rules alone. */
  withRules: number;
  /** The same, with the stored AI signals at high confidence, as "Use AI signals" sets them. */
  withAi: number;
  model: string;
  generatedAt: string;
}

/** Null when no current AI run is stored for the default week, so there is nothing to compare. */
export function labResult(): LabResult | null {
  const week = DEFAULT_SETTINGS.week;
  const run = readCurrentAiRun(week);
  if (!run) return null;
  const { leads, labels } = readWeek(week);
  const prepared = prepareWeek(leads);
  const index = indexLabels(labels, prepared.leads);
  const rulesOnly = runBacktest(prepared, new Map(), index, {
    ...DEFAULT_SETTINGS,
    aiPolicy: "off",
  }).metrics;
  const withAi = runBacktest(prepared, indexAiRun(run, prepared.leads).byLead, index, {
    ...DEFAULT_SETTINGS,
    extraction: "model",
    aiPolicy: "high",
  }).metrics;
  // Both runs spend the same calls, so "x of N" compares like with like.
  if (rulesOnly.callsMade !== withAi.callsMade) return null;
  return {
    weekLabel: leads.label,
    calls: withAi.callsMade,
    withRules: rulesOnly.callsWithNeed,
    withAi: withAi.callsWithNeed,
    model: run.model,
    generatedAt: run.generatedAt,
  };
}
