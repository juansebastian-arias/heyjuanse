/**
 * Scores a stored model run against the answer key. Runs in the browser (the "Under the hood"
 * page) and in the terminal (`pnpm ai:eval`), from the same published files.
 */
import type { AiRunFile, ExtractionStatus } from "../ai/schema";
import { verifyExtraction } from "../ai/verify";
import type { LabelsFile, LeadsFile } from "../data/files";
import type { Confidence, MessageSignals } from "../model";

export const SCORED_FIELDS = ["intent", "timeline", "budget", "nextStep", "language"] as const;
export type ScoredField = (typeof SCORED_FIELDS)[number];

export const SCORED_FIELD_LABELS: Record<ScoredField, string> = {
  intent: "Intent",
  timeline: "Timeline",
  budget: "Budget",
  nextStep: "Next step",
  language: "Language",
};

export interface FieldScore {
  correct: number;
  total: number;
}

export interface Miss {
  rawId: string;
  field: ScoredField | "injection";
  expected: string;
  got: string;
}

export interface AiScorecard {
  weekId: string;
  model: string;
  effort: string;
  promptVersion: string;
  generatedAt: string;
  messages: number;
  statuses: Record<ExtractionStatus, number>;
  fields: Record<ScoredField, FieldScore>;
  /** All four fields that move the score are acceptable. */
  routingFieldsCorrect: FieldScore;
  painPointsExact: FieldScore;
  injection: { caught: number; missed: number; falseAlarms: number; total: number };
  /** By the confidence the rules saw (after verification). */
  byConfidence: Record<Confidence, FieldScore>;
  downgraded: number;
  misses: Miss[];
  usage: AiRunFile["usage"];
}

function acceptable(
  field: ScoredField,
  got: string,
  truth: MessageSignals,
  accept: Record<string, unknown>,
): boolean {
  const expected = truth[field];
  if (got === expected) return true;
  const alternatives = accept[field];
  return Array.isArray(alternatives) && alternatives.includes(got);
}

export function evaluateRun(run: AiRunFile, labels: LabelsFile, leads: LeadsFile): AiScorecard {
  const messages = new Map(leads.rawLeads.map((lead) => [lead.rawId, lead.message]));
  const results = new Map(run.results.map((result) => [result.rawId, result]));
  const statuses: Record<ExtractionStatus, number> = {
    ok: 0,
    refusal: 0,
    max_tokens: 0,
    invalid_output: 0,
    api_error: 0,
  };
  const fields = Object.fromEntries(
    SCORED_FIELDS.map((f) => [f, { correct: 0, total: 0 }]),
  ) as Record<ScoredField, FieldScore>;
  const routingFieldsCorrect: FieldScore = { correct: 0, total: 0 };
  const painPointsExact: FieldScore = { correct: 0, total: 0 };
  const injection = { caught: 0, missed: 0, falseAlarms: 0, total: 0 };
  const byConfidence: Record<Confidence, FieldScore> = {
    high: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    low: { correct: 0, total: 0 },
  };
  const misses: Miss[] = [];
  let downgraded = 0;

  for (const truth of labels.messages) {
    const result = results.get(truth.rawId);
    const text = messages.get(truth.rawId);
    if (!result || !text) continue;
    statuses[result.status]++;
    if (truth.signals.injection) injection.total++;
    if (result.status !== "ok" || !result.output) {
      if (truth.signals.injection) injection.missed++;
      continue;
    }
    const verified = verifyExtraction(result.output, text);
    if (verified.downgraded) downgraded++;
    const got = verified.signals;
    const accept = truth.accept as Record<string, unknown>;
    let routingOk = true;
    for (const field of SCORED_FIELDS) {
      fields[field].total++;
      if (acceptable(field, got[field], truth.signals, accept)) {
        fields[field].correct++;
      } else {
        if (field !== "language") routingOk = false;
        misses.push({ rawId: truth.rawId, field, expected: truth.signals[field], got: got[field] });
      }
    }
    routingFieldsCorrect.total++;
    if (routingOk) routingFieldsCorrect.correct++;
    byConfidence[got.confidence].total++;
    if (routingOk) byConfidence[got.confidence].correct++;
    painPointsExact.total++;
    const expectedPains = [...truth.signals.painPoints].sort().join(",");
    if (got.painPoints.join(",") === expectedPains) painPointsExact.correct++;
    if (truth.signals.injection && got.injection) injection.caught++;
    else if (truth.signals.injection) {
      injection.missed++;
      misses.push({ rawId: truth.rawId, field: "injection", expected: "true", got: "false" });
    } else if (got.injection) {
      injection.falseAlarms++;
      misses.push({ rawId: truth.rawId, field: "injection", expected: "false", got: "true" });
    }
  }

  return {
    weekId: run.weekId,
    model: run.model,
    effort: run.effort,
    promptVersion: run.promptVersion,
    generatedAt: run.generatedAt,
    messages: labels.messages.length,
    statuses,
    fields,
    routingFieldsCorrect,
    painPointsExact,
    injection,
    byConfidence,
    downgraded,
    misses,
    usage: run.usage,
  };
}
