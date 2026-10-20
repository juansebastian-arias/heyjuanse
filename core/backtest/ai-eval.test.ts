import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AiRunFile, Extraction } from "../ai/schema";
import type { LabelsFile, LeadsFile } from "../data/files";
import { evaluateRun } from "./ai-eval";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8")) as T;
const leads = read<LeadsFile>("2026-w41/leads.json");
const labels = read<LabelsFile>("2026-w41/labels.json");
const text = new Map(leads.rawLeads.map((lead) => [lead.rawId, lead.message ?? ""]));

/** A run that answers exactly what the answer key says, quoting the whole message. */
function perfectRun(): AiRunFile {
  return {
    weekId: leads.id,
    model: "answer-key",
    effort: "n/a",
    promptVersion: "test",
    generatorVersion: leads.generatorVersion,
    leadsSha256: "test",
    generatedAt: "2026-10-20T00:00:00.000Z",
    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    results: labels.messages.map((truth) => {
      const message = text.get(truth.rawId) ?? "";
      const quote = message.slice(0, 40);
      const output: Extraction = {
        intent: truth.signals.intent,
        timeline: truth.signals.timeline,
        budget: truth.signals.budget,
        requested_next_step: truth.signals.nextStep,
        pain_points: truth.signals.painPoints,
        language: truth.signals.language,
        injection_attempt: truth.signals.injection,
        evidence: (["intent", "timeline", "budget", "requested_next_step"] as const).map(
          (field) => ({
            field,
            quote,
          }),
        ),
        confidence: "high",
        summary: "",
      };
      return {
        rawId: truth.rawId,
        status: "ok" as const,
        output,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }),
  };
}

describe("evaluateRun", () => {
  it("scores a perfect run at 100%", () => {
    const card = evaluateRun(perfectRun(), labels, leads);
    expect(card.routingFieldsCorrect.correct).toBe(card.routingFieldsCorrect.total);
    expect(card.injection.missed).toBe(0);
    expect(card.injection.falseAlarms).toBe(0);
    expect(card.misses).toHaveLength(0);
    expect(card.statuses.ok).toBe(labels.messages.length);
  });

  it("counts wrong fields, missed injections and failures", () => {
    const run = perfectRun();
    const [first, second, third] = run.results;
    if (!first?.output || !second || !third?.output) throw new Error("need three results");
    first.output = {
      ...first.output,
      budget: first.output.budget === "approved" ? "constrained" : "approved",
    };
    second.status = "refusal";
    second.output = null;
    third.output = { ...third.output, injection_attempt: !third.output.injection_attempt };
    const card = evaluateRun(run, labels, leads);
    expect(card.fields.budget.correct).toBe(card.fields.budget.total - 1);
    expect(card.statuses.refusal).toBe(1);
    expect(card.injection.missed + card.injection.falseAlarms).toBeGreaterThanOrEqual(1);
  });
});
