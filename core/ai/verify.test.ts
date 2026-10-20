import { describe, expect, it } from "vitest";
import type { Extraction } from "./schema";
import { combineSignals } from "./signals";
import { quoteAppearsIn, verifyExtraction } from "./verify";

const message = "We need a demo for our three warehouses. Budget is approved for Q4.";
const base: Extraction = {
  intent: "evaluating_solution",
  timeline: "not_stated",
  budget: "approved",
  requested_next_step: "demo",
  pain_points: [],
  language: "en",
  injection_attempt: false,
  evidence: [
    { field: "intent", quote: "We need a demo for our three warehouses" },
    { field: "budget", quote: "Budget is approved" },
    { field: "requested_next_step", quote: "We need a demo" },
  ],
  confidence: "high",
  summary: "Wants a demo.",
};

describe("verifyExtraction", () => {
  it("keeps the model's confidence when every quote is found", () => {
    const result = verifyExtraction(base, message);
    expect(result.signals.confidence).toBe("high");
    expect(result.downgraded).toBe(false);
  });

  it("downgrades to low when a quote is not in the message", () => {
    const result = verifyExtraction(
      { ...base, evidence: [...base.evidence, { field: "timeline", quote: "go live next week" }] },
      message,
    );
    expect(result.signals.confidence).toBe("low");
    expect(result.unverifiedQuotes).toEqual(["go live next week"]);
  });

  it("downgrades to low when a field that adds points has no quote", () => {
    const result = verifyExtraction({ ...base, timeline: "within_30_days" }, message);
    expect(result.unsupportedFields).toEqual(["timeline"]);
    expect(result.signals.confidence).toBe("low");
  });

  it("matches quotes despite case, spacing and curly quotes", () => {
    expect(quoteAppearsIn("budget  is APPROVED", message)).toBe(true);
    expect(quoteAppearsIn("“We need a demo”", message)).toBe(true);
    expect(quoteAppearsIn("", message)).toBe(false);
  });
});

describe("combineSignals", () => {
  const signals = verifyExtraction(base, message).signals;

  it("lets the most recent stated value win and flags any injection", () => {
    const combined = combineSignals([
      { rawId: "R-1", signals },
      {
        rawId: "R-2",
        signals: {
          ...signals,
          intent: "unclear",
          budget: "not_mentioned",
          injection: true,
          confidence: "medium",
        },
      },
    ]);
    expect(combined?.intent).toBe("evaluating_solution");
    expect(combined?.budget).toBe("approved");
    expect(combined?.injection).toBe(true);
    expect(combined?.rawIds).toEqual(["R-1", "R-2"]);
  });

  it("takes the lowest confidence among the messages that contributed", () => {
    const combined = combineSignals([
      { rawId: "R-1", signals: { ...signals, confidence: "low", timeline: "within_30_days" } },
      { rawId: "R-2", signals: { ...signals, confidence: "high" } },
    ]);
    expect(combined?.timeline).toBe("within_30_days");
    expect(combined?.confidence).toBe("low");
  });

  it("returns null when there are no messages", () => {
    expect(combineSignals([])).toBeNull();
  });
});
