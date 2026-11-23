import { describe, expect, it } from "vitest";
import { LEVER_IDS, type Setup, STATION_IDS, TODAY, withLever } from "./company";
import { compareBuyers, followBuyers } from "./trace";

const ALL: Setup = LEVER_IDS.reduce((setup, id) => withLever(setup, id, true), TODAY);
const FROM = 56;
const TO = 70;

describe("following buyers", () => {
  const traces = [...followBuyers(TODAY, FROM, TO, 4).values()];

  it("follows only would-be buyers who wrote in during the chosen days", () => {
    expect(traces.length).toBeGreaterThan(10);
    for (const trace of traces) {
      expect(trace.request.exitAfter).toBe(STATION_IDS.length);
      expect(Math.floor(trace.request.at / 1440)).toBeGreaterThanOrEqual(FROM);
      expect(Math.floor(trace.request.at / 1440)).toBeLessThan(TO);
    }
  });

  it("tells each story in time order, from the request to how it ended", () => {
    for (const trace of traces) {
      expect(trace.steps[0]?.kind).toBe("arrive");
      for (let i = 1; i < trace.steps.length; i++) {
        expect(trace.steps[i]?.wall).toBeGreaterThanOrEqual(trace.steps[i - 1]?.wall ?? 0);
      }
      const last = trace.steps[trace.steps.length - 1];
      if (trace.fate === "open") continue;
      expect(last?.kind).toBe(trace.fate);
      expect(trace.minutes).toBeCloseTo((last?.wall ?? 0) - trace.request.at, 6);
    }
  });

  it("ends a buyer's story with a payment or with giving up, never by choice", () => {
    const fates = new Set(traces.map((trace) => trace.fate));
    expect(fates.has("exit")).toBe(false);
    expect(fates.has("paid")).toBe(true);
    expect(fates.has("left")).toBe(true);
  });

  it("takes a paid customer through every team in order", () => {
    const paid = traces.find((trace) => trace.fate === "paid");
    const visited = paid?.steps
      .filter((step) => step.kind === "arrive" || step.kind === "enter")
      .map((step) => step.station);
    expect(visited).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("the same buyers in two versions of the company", () => {
  const pairs = compareBuyers(TODAY, ALL, FROM, TO, 4);

  it("pairs every buyer with themselves", () => {
    expect(pairs.length).toBeGreaterThan(10);
    for (const pair of pairs) {
      expect(pair.before.request).toEqual(pair.after.request);
      expect(pair.before.steps[0]).toEqual({ ...pair.after.steps[0] });
    }
  });

  it("keeps most of the buyers that today's company loses", () => {
    const lostBefore = pairs.filter((pair) => pair.before.fate === "left");
    const saved = lostBefore.filter((pair) => pair.after.fate === "paid");
    expect(lostBefore.length).toBeGreaterThan(0);
    expect(saved.length).toBeGreaterThan(lostBefore.length / 2);
  });

  it("gets paid sooner by the customers both versions keep", () => {
    const both = pairs.filter((pair) => pair.before.fate === "paid" && pair.after.fate === "paid");
    const faster = both.filter((pair) => pair.after.minutes < pair.before.minutes);
    expect(faster.length).toBeGreaterThan(both.length * 0.7);
  });
});
