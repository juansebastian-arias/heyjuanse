import { describe, expect, it } from "vitest";
import { erlangA, erlangB, erlangC, mg1Wait, mmcWait } from "./theory";
import { CASES, runChecks, simulateCase } from "./validate";

describe("queueing formulas", () => {
  it("reproduce textbook values", () => {
    expect(erlangB(1, 1)).toBeCloseTo(0.5, 12);
    expect(erlangB(2, 1)).toBeCloseTo(0.2, 12);
    expect(erlangC(1, 0.8)).toBeCloseTo(0.8, 12);
    expect(erlangC(2, 1)).toBeCloseTo(1 / 3, 12);
    // A classic call-centre table entry: 10 erlangs on 13 lines.
    expect(erlangB(13, 10)).toBeCloseTo(0.0843, 3);
  });

  it("agree with the one-person formula everyone knows", () => {
    // Wait = use / (service rate - arrival rate).
    expect(mmcWait(0.08, 10, 1)).toBeCloseTo(0.8 / (0.1 - 0.08), 9);
    expect(mg1Wait(0.08, 10, 1)).toBeCloseTo(mmcWait(0.08, 10, 1), 9);
  });

  it("halve the wait when service times stop varying", () => {
    expect(mg1Wait(0.08, 10, 0)).toBeCloseTo(mmcWait(0.08, 10, 1) / 2, 9);
  });

  it("say the line never stops growing when more work arrives than can be done", () => {
    expect(mmcWait(0.2, 10, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(mg1Wait(0.1, 10, 0.5)).toBe(Number.POSITIVE_INFINITY);
    expect(erlangC(2, 2.5)).toBe(1);
  });

  it("make waits shorter with more people", () => {
    expect(mmcWait(0.08, 30, 4)).toBeLessThan(mmcWait(0.08, 30, 3));
  });

  it("turn into the patient queue when customers almost never give up", () => {
    const impatient = erlangA(0.08, 30, 3, 1e7);
    expect(impatient.meanWait).toBeCloseTo(mmcWait(0.08, 30, 3), 2);
    expect(impatient.abandonShare).toBeLessThan(1e-4);
  });

  it("lose exactly the overflow when customers give up at once", () => {
    // With no patience at all there is no line: whoever finds every person busy leaves.
    const none = erlangA(0.1, 25, 2, 1e-6);
    expect(none.abandonShare).toBeCloseTo(erlangB(2, 2.5), 4);
    expect(none.meanWait).toBeLessThan(1e-4);
  });

  it("keep an overloaded team's losses at least as large as the overload", () => {
    // 2.5 people's worth of work for 2 people: at least a fifth must be lost.
    expect(erlangA(0.1, 25, 2, 60).abandonShare).toBeGreaterThan(0.2);
  });
});

describe("the engine against the formulas", () => {
  const checks = runChecks(80_000, 11);

  it("covers every case, with one person, several people, uneven service and impatience", () => {
    expect(new Set(checks.map((c) => c.case.id))).toEqual(new Set(CASES.map((c) => c.id)));
    expect(checks.length).toBeGreaterThanOrEqual(7);
  });

  it.each(checks.map((c) => [c.case.notation, c.what, c] as const))(
    "%s: %s matches the formula",
    (_notation, _what, c) => {
      expect(Number.isFinite(c.expected)).toBe(true);
      expect(c.margin).toBeGreaterThan(0);
      expect(c.pass).toBe(true);
      expect(Math.abs(c.simulated - c.expected) / c.expected).toBeLessThan(0.05);
    },
  );

  it("measures every customer after the warm-up", () => {
    const queue = CASES[0];
    if (!queue) throw new Error("no cases");
    const samples = simulateCase(queue, 5_000, 3);
    expect(samples.length).toBeGreaterThan(4_700);
    expect(samples.length).toBeLessThanOrEqual(4_750);
    for (const sample of samples) expect(sample.wait).toBeGreaterThanOrEqual(0);
  });
});
