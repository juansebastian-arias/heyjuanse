import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWeek } from "../cleaning/pipeline";
import type { LabelsFile, LeadsFile } from "../data/files";
import { DEFAULT_SETTINGS, type LabSettings } from "../settings";
import { explainChange, plural } from "./explain";
import { indexLabels, leadHasNeed } from "./metrics";
import { answerKeySignals, runBacktest } from "./run";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8")) as T;
const labels = read<LabelsFile>("2026-w41/labels.json");
const prepared = prepareWeek(read<LeadsFile>("2026-w41/leads.json"));
const index = indexLabels(labels, prepared.leads);
const answerKey = answerKeySignals(prepared, labels);
const hasNeed = (leadId: string) => leadHasNeed(leadId, index);

function explain(before: LabSettings, after: LabSettings) {
  const a = runBacktest(prepared, answerKey, index, before);
  const b = runBacktest(prepared, answerKey, index, after);
  return explainChange({
    before: { settings: before, ...a },
    after: { settings: after, ...b },
    hasNeed,
  });
}

describe("explainChange", () => {
  it("explains a threshold change when every call is in use", () => {
    const result = explain(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, threshold: 58 });
    expect(result?.change).toBe("You raised the score threshold from 55 to 58.");
    expect(result?.insight).toContain("not who gets called");
    expect(result?.movement).toMatch(/moved from Sales now \(over capacity\) to Nurture/);
  });

  it("explains unused calls when the threshold is too high", () => {
    const result = explain(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, threshold: 75 });
    expect(result?.insight).toMatch(/go unused|goes unused/);
  });

  it("explains diminishing returns when capacity grows", () => {
    const result = explain(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, capacity: 70 });
    expect(result?.change).toBe("You raised sales capacity from 45 to 70 calls a week.");
    expect(result?.insight).toMatch(/extra calls reached/);
  });

  it("explains what AI changed", () => {
    const result = explain(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, aiPolicy: "high" });
    expect(result?.change).toBe("You turned AI signals on, trusting high confidence only.");
    expect(result?.insight).toMatch(/gained a call/);
    expect(result?.movedLeadIds.length).toBeGreaterThan(0);
  });

  it("says nothing when nothing changed or the week changed", () => {
    expect(explain(DEFAULT_SETTINGS, DEFAULT_SETTINGS)).toBeNull();
    expect(explain(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, week: "2026-w40" })).toBeNull();
  });

  it("pluralizes correctly", () => {
    expect(plural(1, "lead")).toBe("1 lead");
    expect(plural(2, "lead")).toBe("2 leads");
    expect(plural(1200, "call")).toBe("1,200 calls");
  });
});
