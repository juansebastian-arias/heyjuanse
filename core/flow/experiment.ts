/**
 * Experiments: run the same quarter many times, each time with different customers, and report
 * what usually happens and how much it varies.
 *
 * Two setups are always compared on the same customers, run by run, so the comparison is a
 * controlled experiment: the difference between them is measured on each simulated quarter and
 * only then summarized.
 */
import { OFFICE, WORK_DAY } from "./calendar";
import {
  type Assumptions,
  BASE,
  capacityHours,
  costOf,
  hasLever,
  peopleAt,
  resolve,
  type Setup,
  SIGNED_AFTER,
  STATION_IDS,
  type StationId,
} from "./company";
import { FlowSim } from "./engine";
import { mean, median, percentile, Recorder, type RunStats } from "./metrics";
import { type Demand, demandFor } from "./requests";

/** Working days simulated before measuring starts, so the quarter opens with work already in progress. */
export const WARMUP_DAYS = 30;
/** Thirteen weeks. */
export const QUARTER_DAYS = 65;
const MONTHS_PER_QUARTER = 3;

export const TOTAL_KEYS = [
  "requests",
  "buyers",
  "signed",
  "paid",
  "cash",
  "lostBuyers",
  "lostValue",
  "replyHours",
  "cashDays",
  "signedToCashDays",
  "handsOnHours",
  "usageCost",
  "net",
] as const;
export type TotalKey = (typeof TOTAL_KEYS)[number];

export const STATION_KEYS = [
  "arrivals",
  "handled",
  "waitHours",
  "meanWaitHours",
  "closedHours",
  "assignHours",
  "lineHours",
  "loadHours",
  "capacityHours",
  "busyShare",
  "leftBuyers",
  "leftValue",
  "backlogStart",
  "backlogEnd",
  "redoShare",
  "autoShare",
] as const;
export type StationKey = (typeof STATION_KEYS)[number];

/**
 * One simulated quarter, as a manager would read it. Counts and money are per month; waits are
 * medians in calendar time.
 */
export interface Summary {
  totals: Record<TotalKey, number>;
  stations: Record<StationId, Record<StationKey, number>>;
}

/** Runs one quarter and returns the raw counts. */
export function runQuarter(
  setup: Setup,
  seed: number,
  a: Assumptions = BASE,
  demand: Demand = demandFor(seed, a),
): RunStats {
  const sim = new FlowSim(resolve(setup, a), demand, OFFICE);
  const window = { from: WARMUP_DAYS * WORK_DAY, to: (WARMUP_DAYS + QUARTER_DAYS) * WORK_DAY };
  const recorder = new Recorder(STATION_IDS.length, window, SIGNED_AFTER);
  sim.on(recorder.listen);
  // Stop a hair before each edge, so events on the edge itself fall on the right side of it.
  sim.advanceTo(window.from - 1e-6);
  recorder.snapshot(sim, "start");
  sim.advanceTo(window.to - 1e-6);
  recorder.snapshot(sim, "end");
  return recorder.stats;
}

const HOUR = 60;
const CALENDAR_DAY = 24 * 60;

export function summarize(stats: RunStats, setup: Setup, a: Assumptions = BASE): Summary {
  const days = (stats.window.to - stats.window.from) / WORK_DAY;
  const perMonth = 1 / MONTHS_PER_QUARTER;
  const stations = {} as Summary["stations"];
  let lostBuyers = 0;
  let lostValue = 0;
  let handsOn = 0;
  STATION_IDS.forEach((id, index) => {
    const run = stats.stations[index];
    if (!run) throw new Error(`No measurements for ${id}`);
    const started = Math.max(1, run.started);
    const needsPerson = run.entered - run.auto;
    const meanTouch =
      run.handled + run.started > 0 ? run.touchMinutes / Math.max(1, run.started + run.redo) : 0;
    lostBuyers += run.leftBuyers;
    lostValue += run.leftValue;
    handsOn += run.touchMinutes;
    stations[id] = {
      arrivals: run.entered / days,
      handled: run.handled / days,
      waitHours: median(run.waits) / HOUR,
      meanWaitHours: mean(run.waits) / HOUR,
      closedHours: run.closedMinutes / started / HOUR,
      assignHours: run.assignMinutes / started / HOUR,
      lineHours: run.lineMinutes / started / HOUR,
      // Hours of hands-on work that arrive in a day, second passes included.
      loadHours: ((needsPerson + run.redo) * meanTouch) / days / HOUR,
      capacityHours: capacityHours(setup, id, a),
      busyShare: run.busyMinutes / (peopleAt(setup, id, a) * (stats.window.to - stats.window.from)),
      leftBuyers: run.leftBuyers * perMonth,
      leftValue: run.leftValue * perMonth,
      backlogStart: run.backlogStart,
      backlogEnd: run.backlogEnd,
      redoShare: run.started > 0 ? run.redo / run.started : 0,
      autoShare: run.entered > 0 ? run.auto / run.entered : 0,
    };
  });
  const drafts = hasLever(setup, "replyDrafts") ? (stats.stations[0]?.handled ?? 0) : 0;
  const usageCost = drafts * a.costPerDraft * perMonth;
  const cash = stats.paidValue * perMonth;
  return {
    totals: {
      requests: stats.requests * perMonth,
      buyers: stats.buyers * perMonth,
      signed: stats.signed * perMonth,
      paid: stats.paid * perMonth,
      cash,
      lostBuyers: lostBuyers * perMonth,
      lostValue: lostValue * perMonth,
      replyHours: median(stats.replyMinutes) / HOUR,
      cashDays: median(stats.cashMinutes) / CALENDAR_DAY,
      signedToCashDays: median(stats.signedToCashMinutes) / CALENDAR_DAY,
      handsOnHours: (handsOn / HOUR) * perMonth,
      usageCost,
      // What is left of the money that came in, after serving those customers and paying for
      // the changes. Used to rank changes, never shown as a forecast of profit.
      net: cash * a.margin - costOf(setup, a).monthly - usageCost,
    },
    stations,
  };
}

/** One demand stream per run, shared by every setup that is compared under the same assumptions. */
export function demands(runs: number, a: Assumptions = BASE): Demand[] {
  return Array.from({ length: runs }, (_, run) => demandFor(run + 1, a));
}

/** Runs a setup once per demand stream. */
export function runMany(
  setup: Setup,
  streams: readonly Demand[],
  a: Assumptions = BASE,
): Summary[] {
  return streams.map((demand, run) => summarize(runQuarter(setup, run + 1, a, demand), setup, a));
}

/** A typical value and the range that eight simulated quarters in ten fall inside. */
export interface Estimate {
  mean: number;
  low: number;
  high: number;
}

/** A difference between two setups on the same customers. */
export interface Difference extends Estimate {
  /** Share of simulated quarters in which the difference was above zero. */
  positive: number;
  /** Standard error of the mean difference: how far the mean itself could be off. */
  se: number;
}

/** True when a mean difference is too large to be an accident of which quarters were simulated. */
export function isClear(difference: Difference): boolean {
  return Math.abs(difference.mean) > 2 * difference.se;
}

export interface Projection {
  runs: number;
  totals: Record<TotalKey, Estimate>;
  stations: Record<StationId, Record<StationKey, Estimate>>;
}

function standardError(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  let squares = 0;
  for (const value of values) squares += (value - center) ** 2;
  return Math.sqrt(squares / (values.length - 1) / values.length);
}

function estimate(values: readonly number[]): Estimate {
  return { mean: mean(values), low: percentile(values, 0.1), high: percentile(values, 0.9) };
}

export function project(summaries: readonly Summary[]): Projection {
  const totals = {} as Projection["totals"];
  for (const key of TOTAL_KEYS) totals[key] = estimate(summaries.map((s) => s.totals[key]));
  const stations = {} as Projection["stations"];
  for (const id of STATION_IDS) {
    const metrics = {} as Record<StationKey, Estimate>;
    for (const key of STATION_KEYS) {
      metrics[key] = estimate(summaries.map((s) => s.stations[id][key]));
    }
    stations[id] = metrics;
  }
  return { runs: summaries.length, totals, stations };
}

/** `after` minus `before`, run by run. Both lists must come from the same demand streams. */
export function difference(
  before: readonly Summary[],
  after: readonly Summary[],
  key: TotalKey,
): Difference {
  if (before.length !== after.length) throw new Error("Paired runs must be the same length");
  const deltas = after.map((summary, run) => summary.totals[key] - (before[run]?.totals[key] ?? 0));
  const positive = deltas.filter((delta) => delta > 0).length / Math.max(1, deltas.length);
  return { ...estimate(deltas), positive, se: standardError(deltas) };
}
