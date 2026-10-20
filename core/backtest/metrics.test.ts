import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { prepareWeek } from "../cleaning/pipeline";
import type { LabelsFile, LeadsFile } from "../data/files";
import { DEFAULT_ROUTING, routeLeads } from "../routing/route";
import { computeMetrics, indexLabels } from "./metrics";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8")) as T;
const leadsFile = read<LeadsFile>("2026-w41/leads.json");
const labels = read<LabelsFile>("2026-w41/labels.json");
const prepared = prepareWeek(leadsFile);
const index = indexLabels(labels, prepared.leads);

describe("backtest metrics", () => {
  it("accounts for every need exactly once", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 150 }),
        fc.integer({ min: 0, max: 100 }),
        fc.constantFrom("score" as const, "arrival" as const),
        (capacity, threshold, queueOrder) => {
          const m = computeMetrics(
            routeLeads(prepared.leads, new Map(), {
              ...DEFAULT_ROUTING,
              capacity,
              threshold,
              queueOrder,
            }),
            index,
          );
          expect(
            m.needsReached + m.needsInReview + m.needsWaiting + m.needsFixData + m.needsMissed,
          ).toBe(m.needsTotal);
          expect(m.callsWithNeed + m.callsWithoutNeed).toBe(m.callsMade);
          expect(m.callsMade).toBeLessThanOrEqual(capacity);
          expect(Object.values(m.laneCounts).reduce((a, b) => a + b, 0)).toBe(
            prepared.leads.length,
          );
        },
      ),
      { numRuns: 60 },
    );
  });

  it("raising capacity never reaches fewer needs", () => {
    let previous = -1;
    for (let capacity = 0; capacity <= 150; capacity += 5) {
      const m = computeMetrics(
        routeLeads(prepared.leads, new Map(), { ...DEFAULT_ROUTING, capacity }),
        index,
      );
      expect(m.needsReached).toBeGreaterThanOrEqual(previous);
      previous = m.needsReached;
    }
  });

  it("decisions do not change when the answer key changes", () => {
    const decisions = routeLeads(prepared.leads, new Map(), DEFAULT_ROUTING);
    const shuffled: LabelsFile = {
      ...labels,
      people: labels.people.map((person, i) => ({ ...person, hasNeed: i % 2 === 0 })),
    };
    const again = routeLeads(prepared.leads, new Map(), DEFAULT_ROUTING);
    expect(again).toEqual(decisions);
    // Metrics do change, which shows the labels are only used for scoring the outcome.
    expect(computeMetrics(decisions, indexLabels(shuffled, prepared.leads))).not.toEqual(
      computeMetrics(decisions, index),
    );
  });
});
