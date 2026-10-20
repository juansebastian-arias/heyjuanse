/**
 * One backtest run: the week's leads, the AI signals allowed by the settings, the routing
 * rules, and the metrics against the answer key.
 */
import { combineSignals, type LeadAiSignals } from "../ai/signals";
import type { PreparedWeek } from "../cleaning/pipeline";
import type { LabelsFile } from "../data/files";
import { type Decision, routeLeads } from "../routing/route";
import type { LabSettings } from "../settings";
import { computeMetrics, type LeadLabelIndex, type Metrics } from "./metrics";

/**
 * Signals copied from the answer key, as if extraction were perfect. Used only to show an upper
 * bound, and always labelled as the answer key, never as AI output.
 */
export function answerKeySignals(
  prepared: PreparedWeek,
  labels: LabelsFile,
): Map<string, LeadAiSignals> {
  const truth = new Map(labels.messages.map((message) => [message.rawId, message.signals]));
  const result = new Map<string, LeadAiSignals>();
  for (const lead of prepared.leads) {
    const messages = lead.messages.flatMap((message) => {
      const signals = truth.get(message.rawId);
      return signals
        ? [{ rawId: message.rawId, signals: { ...signals, confidence: "high" as const } }]
        : [];
    });
    const combined = combineSignals(messages);
    if (combined) result.set(lead.leadId, combined);
  }
  return result;
}

export interface BacktestResult {
  decisions: Decision[];
  metrics: Metrics;
}

export function runBacktest(
  prepared: PreparedWeek,
  aiByLead: ReadonlyMap<string, LeadAiSignals>,
  index: LeadLabelIndex,
  settings: LabSettings,
): BacktestResult {
  const decisions = routeLeads(prepared.leads, aiByLead, settings);
  return { decisions, metrics: computeMetrics(decisions, index) };
}
