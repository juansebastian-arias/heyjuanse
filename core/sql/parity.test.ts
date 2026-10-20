/**
 * The SQL the page shows must give the same answers as the reference implementation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { computeMetrics, indexLabels } from "../backtest/metrics";
import { prepareWeek } from "../cleaning/pipeline";
import type { LabelsFile, LeadsFile } from "../data/files";
import { DEFAULT_ROUTING, routeLeads } from "../routing/route";
import { signals } from "../test/fixtures";
import { loadWeek, runMetrics, runQuery, type SqlDatabase, writeDecisions } from "./load";
import { DATA_QUALITY_QUERIES } from "./queries";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8")) as T;

describe.each(["2026-w39", "2026-w41"])("SQL metrics for %s", (week) => {
  const leadsFile = read<LeadsFile>(`${week}/leads.json`);
  const labels = read<LabelsFile>(`${week}/labels.json`);
  const prepared = prepareWeek(leadsFile);
  const index = indexLabels(labels, prepared.leads);
  // Some synthetic AI signals so the AI paths are exercised too.
  const ai = new Map(
    prepared.leads
      .filter((lead) => lead.messages.length > 0)
      .map((lead, i) => [
        lead.leadId,
        signals({
          confidence: (["high", "medium", "low"] as const)[i % 3],
          injection: i % 17 === 0,
          intent: i % 5 === 0 ? "vendor_or_partner_pitch" : "evaluating_solution",
          rawIds: lead.messages.map((m) => m.rawId),
        }),
      ]),
  );
  let db: SqlDatabase;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database() as unknown as SqlDatabase;
    loadWeek(db, prepared, labels);
  });

  it("match the reference implementation for any settings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 150 }),
        fc.integer({ min: 0, max: 100 }),
        fc.constantFrom("off" as const, "high" as const, "high_medium" as const),
        fc.constantFrom("score" as const, "arrival" as const),
        (capacity, threshold, aiPolicy, queueOrder) => {
          const decisions = routeLeads(prepared.leads, ai, {
            ...DEFAULT_ROUTING,
            capacity,
            threshold,
            aiPolicy,
            queueOrder,
          });
          writeDecisions(db, decisions);
          const sql = runMetrics(db);
          const ts = computeMetrics(decisions, index);
          expect(sql.needsTotal).toBe(ts.needsTotal);
          expect(sql.needsReached).toBe(ts.needsReached);
          expect(sql.needsWaiting).toBe(ts.needsWaiting);
          expect(sql.needsInReview).toBe(ts.needsInReview);
          expect(sql.needsFixData).toBe(ts.needsFixData);
          expect(sql.needsMissed).toBe(ts.needsMissed);
          expect(sql.callsMade).toBe(ts.callsMade);
          expect(sql.callsWithoutNeed).toBe(ts.callsWithoutNeed);
          expect(sql.reviewCases).toBe(ts.reviewCases);
          if (ts.salesPrecision === null) expect(sql.salesPrecision).toBeNull();
          else expect(sql.salesPrecision).toBeCloseTo(ts.salesPrecision, 10);
          expect(sql.laneCounts).toEqual(ts.laneCounts);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("report duplicate detection against the answer key", () => {
    const result = runQuery(db, DATA_QUALITY_QUERIES.duplicatesAgainstTruth);
    expect(result.columns).toEqual(["false_merges", "missed_duplicates", "people_with_duplicates"]);
    const [falseMerges, missed, withDuplicates] = result.rows[0] ?? [];
    expect(Number(falseMerges)).toBeLessThanOrEqual(2);
    expect(Number(missed)).toBeLessThan(Number(withDuplicates));
  });
});
