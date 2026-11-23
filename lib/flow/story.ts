/**
 * One customer's path through the company, as the handful of moments a person would name: wrote
 * in, got a reply, got a quote, signed, was set up, was invoiced, paid. Built from the engine's
 * own record of what happened to that customer, so it cannot say anything the simulation did not do.
 */
import { clockLabel } from "@/core/flow/calendar";
import {
  type Assumptions,
  BASE,
  type Setup,
  STATION_IDS,
  STATIONS,
  type StationId,
  TODAY,
} from "@/core/flow/company";
import { compareBuyers, type Pair, type Trace } from "@/core/flow/trace";
import { duration, money } from "./format";
import { LIVE_SEED } from "./live";
import { WAITING_FOR } from "./words";

/** The calendar days whose would-be buyers can be followed: the week before the floor opens. */
export const FOLLOWED_DAYS = { from: 63, to: 70 } as const;

/**
 * Those buyers, each followed through today's company and through another setup. They come from
 * the same stream of customers the floor shows, so the people in the stories are the dots.
 */
export function followedBuyers(setup: Setup, a: Assumptions = BASE): Pair[] {
  return compareBuyers(TODAY, setup, FOLLOWED_DAYS.from, FOLLOWED_DAYS.to, LIVE_SEED, a);
}

export const MOMENTS = [
  "Wrote in",
  "First reply",
  "Call and quote",
  "Contract approved",
  "Set up and running",
  "Invoice sent",
  "Paid",
] as const;

export interface Moment {
  /** Calendar minute it happened. Null: it never did. */
  wall: number | null;
  /** Something worth saying about how it happened. */
  note: string | null;
  /** The customer gave up while waiting for this. */
  gaveUp: boolean;
}

export interface Story {
  moments: Moment[];
  ending: string;
}

const empty = (): Moment => ({ wall: null, note: null, gaveUp: false });

export function storyOf(trace: Trace): Story {
  const moments: Moment[] = MOMENTS.map(empty);
  const at = (index: number): Moment => moments[index] ?? empty();
  at(0).wall = trace.request.at;
  let disputes = 0;
  for (const step of trace.steps) {
    // Moments 1 to 5 are the five teams finishing their part, in order.
    const moment = at(step.station + 1);
    if (step.kind === "done" && step.station < STATION_IDS.length - 1) {
      moment.wall = step.wall;
    } else if (step.kind === "auto") {
      moment.wall = step.wall;
      moment.note = "approved by rule, no wait";
    } else if (step.kind === "redo") {
      disputes++;
    } else if (step.kind === "billed") {
      const invoice = at(STATION_IDS.length);
      invoice.wall = step.wall;
      invoice.note = disputes > 0 ? "after the first one was disputed and redone" : null;
    } else if (step.kind === "paid") {
      at(MOMENTS.length - 1).wall = step.wall;
    } else if (step.kind === "left") {
      moment.wall = step.wall;
      moment.gaveUp = true;
    }
  }
  return { moments, ending: endingOf(trace) };
}

function endingOf(trace: Trace): string {
  const value = money(trace.request.value);
  const took = duration(trace.minutes / 60);
  if (trace.fate === "paid") return `Paid ${value}, ${took} after writing in.`;
  if (trace.fate === "left") {
    const station: StationId = STATION_IDS[trace.station] ?? "reply";
    return `Gave up after ${took}, still waiting ${WAITING_FOR[station]}. ${value} not sold.`;
  }
  if (trace.fate === "exit") {
    const station: StationId = STATION_IDS[trace.station] ?? "reply";
    return `Left by choice at ${STATIONS[station].name}.`;
  }
  return "Still in progress when the simulation ended.";
}

/** "Tue 09:42", and how long after the request that was. */
export function momentText(moment: Moment, requestAt: number): string {
  if (moment.wall === null) return "–";
  const after = moment.wall - requestAt;
  const when = clockLabel(moment.wall);
  return after < 1 ? when : `${when}, ${duration(after / 60)} in`;
}
