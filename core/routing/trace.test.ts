import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { answerKeySignals } from "../backtest/run";
import { prepareWeek } from "../cleaning/pipeline";
import type { LabelsFile, LeadsFile } from "../data/files";
import { DEFAULT_ROUTING, routeLeads } from "./route";
import { finalLane, traceDecision } from "./trace";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8")) as T;
const prepared = prepareWeek(read<LeadsFile>("2026-w40/leads.json"));
const labels = read<LabelsFile>("2026-w40/labels.json");
// Vary confidence so the untrusted path is exercised too.
const ai = new Map(
  [...answerKeySignals(prepared, labels)].map(([leadId, signals], i) => [
    leadId,
    { ...signals, confidence: (["high", "medium", "low"] as const)[i % 3] ?? "high" },
  ]),
);

describe("decision trace", () => {
  it("always ends in the lane the router chose", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 15, max: 120 }),
        fc.integer({ min: 30, max: 90 }),
        fc.constantFrom("off" as const, "high" as const, "high_medium" as const),
        fc.constantFrom("score" as const, "arrival" as const),
        (capacity, threshold, aiPolicy, queueOrder) => {
          const settings = { ...DEFAULT_ROUTING, capacity, threshold, aiPolicy, queueOrder };
          const decisions = routeLeads(prepared.leads, ai, settings);
          const queueLength = decisions.filter((d) => d.lane === "sales").length;
          decisions.forEach((decision, i) => {
            const lead = prepared.leads[i];
            if (!lead) throw new Error("lead missing");
            const steps = traceDecision(
              lead,
              ai.get(lead.leadId) ?? null,
              settings,
              decision,
              queueLength,
            );
            expect(finalLane(steps), `${lead.leadId}`).toBe(decision.lane);
          });
        },
      ),
      { numRuns: 25 },
    );
  });
});
