import { describe, expect, it } from "vitest";
import { OFFICE, WORK_DAY } from "./calendar";
import {
  BASE,
  capacityHours,
  costOf,
  LEVER_IDS,
  resolve,
  type Setup,
  SIGNED_AFTER,
  STATION_IDS,
  TODAY,
  withExtra,
  withLever,
} from "./company";
import { FlowSim } from "./engine";
import {
  demands,
  difference,
  isClear,
  project,
  QUARTER_DAYS,
  runMany,
  runQuarter,
  type Summary,
  summarize,
  WARMUP_DAYS,
} from "./experiment";
import { mean, median, percentile, Recorder } from "./metrics";
import { demandFor } from "./requests";

const ALL: Setup = LEVER_IDS.reduce((setup, id) => withLever(setup, id, true), TODAY);
const streams = demands(12);
const today = runMany(TODAY, streams);
const routed = runMany(withLever(TODAY, "routing", true), streams);
const everything = runMany(ALL, streams);

describe("summary statistics", () => {
  it("find the middle and the edges of a list", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(percentile([10, 20, 30, 40, 50], 0.1)).toBeCloseTo(14, 9);
    expect(percentile([10, 20, 30, 40, 50], 0.9)).toBeCloseTo(46, 9);
    expect(percentile([7], 0.9)).toBe(7);
    expect(mean([1, 2, 6])).toBe(3);
  });

  it("answer 0 for an empty list instead of failing", () => {
    expect(median([])).toBe(0);
    expect(mean([])).toBe(0);
  });

  it("leave the list they were given untouched", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("one simulated quarter", () => {
  const stats = runQuarter(TODAY, 1);
  const summary = summarize(stats, TODAY);

  it("measures thirteen weeks after a warm-up", () => {
    expect(stats.window.from).toBe(WARMUP_DAYS * WORK_DAY);
    expect(stats.window.to - stats.window.from).toBe(QUARTER_DAYS * WORK_DAY);
  });

  it("counts exactly the requests that reach the company inside the window", () => {
    const demand = demandFor(1);
    let expected = 0;
    for (let day = 0; day < 200; day++) {
      for (const r of demand(day)) {
        const work = OFFICE.workOfWall(r.at);
        if (work >= stats.window.from && work < stats.window.to) expected++;
      }
    }
    expect(stats.requests).toBe(expected);
    expect(stats.stations[0]?.entered).toBe(expected);
  });

  it("starts with work already in progress", () => {
    expect(stats.stations.reduce((sum, station) => sum + station.backlogStart, 0)).toBeGreaterThan(
      0,
    );
    expect(stats.paid).toBeGreaterThan(0);
  });

  it("reports counts and money per month", () => {
    expect(summary.totals.paid * 3).toBeCloseTo(stats.paid, 9);
    expect(summary.totals.cash * 3).toBeCloseTo(stats.paidValue, 6);
    expect(summary.totals.requests * 3).toBeCloseTo(stats.requests, 9);
  });

  it("never has a team busier than its people allow", () => {
    for (const id of STATION_IDS) {
      expect(summary.stations[id].busyShare).toBeGreaterThan(0);
      expect(summary.stations[id].busyShare).toBeLessThanOrEqual(1 + 1e-9);
      expect(summary.stations[id].capacityHours).toBe(capacityHours(TODAY, id));
    }
  });

  it("splits every wait into closed hours, waiting for hand-out and standing in line", () => {
    for (const id of STATION_IDS) {
      const s = summary.stations[id];
      expect(s.closedHours + s.assignHours + s.lineHours).toBeCloseTo(s.meanWaitHours, 6);
    }
    expect(summary.stations.reply.assignHours).toBeGreaterThan(10);
    expect(summary.stations.quote.assignHours).toBe(0);
  });

  it("keeps what is left after costs consistent with its parts", () => {
    const s = summarize(runQuarter(ALL, 1), ALL);
    expect(s.totals.usageCost).toBeGreaterThan(0);
    expect(s.totals.net).toBeCloseTo(
      s.totals.cash * BASE.margin - costOf(ALL).monthly - s.totals.usageCost,
      6,
    );
    expect(summary.totals.usageCost).toBe(0);
  });
});

describe("the recorder", () => {
  it("balances each team's books over a whole run", () => {
    const sim = new FlowSim(resolve(TODAY), demandFor(2), OFFICE);
    const end = 60 * WORK_DAY;
    const recorder = new Recorder(STATION_IDS.length, { from: 0, to: end + 1 }, SIGNED_AFTER);
    sim.on(recorder.listen);
    sim.advanceTo(end);
    recorder.snapshot(sim, "end");
    // Teams with no second passes: everything that came in was skipped, started, lost or is waiting.
    for (const index of [0, 1, 2, 3]) {
      const s = recorder.stats.stations[index];
      if (!s) throw new Error("missing station");
      expect(s.entered).toBe(s.auto + s.started + s.left + s.backlogEnd);
      expect(s.waits).toHaveLength(s.started);
    }
    expect(recorder.stats.signed).toBe(recorder.stats.stations[3]?.entered);
  });

  it("measures the time from signature to payment for everyone who paid", () => {
    const stats = runQuarter(TODAY, 3);
    expect(stats.signedToCashMinutes).toHaveLength(stats.paid);
    expect(stats.cashMinutes).toHaveLength(stats.paid);
    for (const [index, minutes] of stats.signedToCashMinutes.entries()) {
      expect(minutes).toBeGreaterThan(0);
      expect(minutes).toBeLessThan(stats.cashMinutes[index] ?? 0);
    }
  });
});

describe("comparing setups on the same customers", () => {
  it("gives both setups exactly the same requests and the same would-be buyers", () => {
    for (const [run, summary] of today.entries()) {
      expect(routed[run]?.totals.requests).toBe(summary.totals.requests);
      expect(everything[run]?.totals.buyers).toBe(summary.totals.buyers);
    }
  });

  it("reproduces a run exactly", () => {
    expect(runMany(TODAY, demands(3))).toEqual(today.slice(0, 3));
  });

  it("shows the reply getting faster when requests are assigned on arrival", () => {
    const reply = difference(today, routed, "replyHours");
    expect(reply.mean).toBeLessThan(-10);
    expect(reply.positive).toBe(0);
    expect(isClear(reply)).toBe(true);
  });

  it("shows far fewer buyers lost, and more cash, with every improvement on", () => {
    const lost = difference(today, everything, "lostBuyers");
    const cash = difference(today, everything, "cash");
    expect(project(everything).totals.lostBuyers.mean).toBeLessThan(
      project(today).totals.lostBuyers.mean / 2,
    );
    expect(lost.positive).toBe(0);
    expect(cash.positive).toBe(1);
    expect(cash.low).toBeGreaterThan(0);
  });

  it("finds no difference between a setup and itself", () => {
    const same = difference(today, today, "cash");
    expect(same).toEqual({ mean: 0, low: 0, high: 0, positive: 0, se: 0 });
    expect(isClear(same)).toBe(false);
  });

  it("charges for people and tools, not for results", () => {
    const hired = withExtra(TODAY, "quote", 1);
    const runs = runMany(hired, streams.slice(0, 3));
    for (const [run, summary] of runs.entries()) {
      const before = today[run] as Summary;
      const expected =
        (summary.totals.cash - before.totals.cash) * BASE.margin - BASE.monthlyCost.quote;
      expect(summary.totals.net - before.totals.net).toBeCloseTo(expected, 6);
    }
  });

  it("refuses to pair lists of different lengths", () => {
    expect(() => difference(today, today.slice(1), "cash")).toThrow();
  });

  it("summarizes runs as a typical value inside a range", () => {
    const p = project(today);
    expect(p.runs).toBe(12);
    for (const estimate of Object.values(p.totals)) {
      expect(estimate.low).toBeLessThanOrEqual(estimate.high);
      expect(Number.isFinite(estimate.mean)).toBe(true);
    }
  });
});
