/**
 * Following single customers. Because chance is settled per customer, the same customer can be
 * sent through two versions of the company and the two stories compared step by step: where
 * they waited, for how long, and how it ended.
 */
import { OFFICE, WORK_DAY } from "./calendar";
import { type Assumptions, BASE, resolve, type Setup, STATION_IDS } from "./company";
import { FlowSim, type Request, type SimEventKind } from "./engine";
import { type Demand, demandFor, isBuyer } from "./requests";

export interface TraceStep {
  kind: SimEventKind;
  /** Index of the station, or the number of stations for the payment. */
  station: number;
  /** Calendar minute. */
  wall: number;
}

export type Fate =
  | "paid"
  /** Gave up waiting. */
  | "left"
  /** Left by choice: not a fit, said no to the quote, or did not sign. */
  | "exit"
  /** Still in progress when the trace ended. */
  | "open";

export interface Trace {
  request: Request;
  steps: TraceStep[];
  fate: Fate;
  /** Station where the story ended, for "left" and "exit". */
  station: number;
  /** Calendar minutes from the request to the end of the story. */
  minutes: number;
}

/** Working days simulated after the last arrival of interest, so their stories can finish. */
const TAIL_DAYS = 70;

/**
 * The story of every would-be buyer who writes in during a span of calendar days, under one
 * setup. The simulation starts from an empty company on day 0, so earlier customers are in the
 * lines these ones join.
 */
export function followBuyers(
  setup: Setup,
  fromDay: number,
  toDay: number,
  seed: number,
  a: Assumptions = BASE,
  demand: Demand = demandFor(seed, a),
): Map<number, Trace> {
  const traces = new Map<number, Trace>();
  for (let day = fromDay; day < toDay; day++) {
    for (const request of demand(day)) {
      if (!isBuyer(request)) continue;
      traces.set(request.id, { request, steps: [], fate: "open", station: 0, minutes: 0 });
    }
  }
  const sim = new FlowSim(resolve(setup, a), demand, OFFICE);
  sim.on((kind, item, station, flow) => {
    const trace = traces.get(item.req.id);
    if (!trace) return;
    const wall = flow.wall;
    trace.steps.push({ kind, station, wall });
    if (kind === "paid" || kind === "left" || kind === "exit") {
      trace.fate = kind;
      trace.station = Math.min(station, STATION_IDS.length - 1);
      trace.minutes = wall - item.req.at;
    }
  });
  const lastWorkDay = Math.ceil(OFFICE.workOfWall(toDay * 24 * 60) / WORK_DAY);
  sim.advanceTo((lastWorkDay + TAIL_DAYS) * WORK_DAY);
  return traces;
}

export interface Pair {
  request: Request;
  before: Trace;
  after: Trace;
}

/** The same buyers under two setups, in the order they wrote in. */
export function compareBuyers(
  before: Setup,
  after: Setup,
  fromDay: number,
  toDay: number,
  seed: number,
  a: Assumptions = BASE,
): Pair[] {
  const demand = demandFor(seed, a);
  const first = followBuyers(before, fromDay, toDay, seed, a, demand);
  const second = followBuyers(after, fromDay, toDay, seed, a, demand);
  const pairs: Pair[] = [];
  for (const [id, trace] of first) {
    const other = second.get(id);
    if (other) pairs.push({ request: trace.request, before: trace, after: other });
  }
  return pairs.sort((x, y) => x.request.at - y.request.at);
}
