/**
 * Reading a projection the way an operations person would: for each team, how long work waits
 * and why, how much of the team's time the work takes, and how many buyers give up there.
 *
 * Everything here is measured from simulated runs. The "why" is a rule applied to those
 * measurements, written out below, so the same numbers always give the same explanation.
 */
import { STATION_IDS, type StationId } from "./company";
import type { Projection } from "./experiment";

export type Cause =
  /** Work waits to be handed out, not to be done. */
  | "handout"
  /** More hours of work arrive than the team has. */
  | "overload"
  /** Work arrives about as fast as the team can do it. */
  | "full"
  /** The team keeps up on average but has little slack to absorb a busy day. */
  | "tight"
  /** Most of the wait is for the office to open. */
  | "hours"
  /** The team has time to spare; each item still waits for its turn. */
  | "turn"
  | "clear";

export interface Reading {
  station: StationId;
  /** Average hours a first-time item waits for a person, and where those hours go. */
  waitHours: number;
  closedHours: number;
  assignHours: number;
  lineHours: number;
  /** Hours of hands-on work that arrive in a day, and hours the team can give it. */
  loadHours: number;
  capacityHours: number;
  /** Share of the team's hours spent on this work. */
  busyShare: number;
  /** Buyers a month who give up waiting here, and what they would have paid. */
  lostBuyers: number;
  lostValue: number;
  /** Share of items sent back for a second pass, and share that needed no person. */
  redoShare: number;
  autoShare: number;
  cause: Cause;
}

/** A wait shorter than this is not worth explaining. */
const NOTICEABLE_HOURS = 1;
/** Work arriving as a share of the team's hours, from which a team counts as overloaded, full and tight. */
const OVERLOAD = 1;
const FULL = 0.95;
const TIGHT = 0.8;

/**
 * Why work waits at a team. The rule, in order: a short wait needs no reason; if most of the wait
 * is spent unassigned, it is the hand-out; a team with as much work as hours has a capacity
 * problem whatever else is true; otherwise the largest part of the wait names the cause.
 */
export function causeOf(reading: Omit<Reading, "cause">): Cause {
  const { waitHours, assignHours, closedHours, lineHours, loadHours, capacityHours } = reading;
  if (waitHours < NOTICEABLE_HOURS) return "clear";
  if (assignHours >= Math.max(closedHours, lineHours)) return "handout";
  const use = capacityHours > 0 ? loadHours / capacityHours : 0;
  if (use >= OVERLOAD) return "overload";
  if (use >= FULL) return "full";
  if (closedHours >= lineHours) return "hours";
  return use >= TIGHT ? "tight" : "turn";
}

export function readStation(projection: Projection, station: StationId): Reading {
  const s = projection.stations[station];
  const reading = {
    station,
    waitHours: s.meanWaitHours.mean,
    closedHours: s.closedHours.mean,
    assignHours: s.assignHours.mean,
    lineHours: s.lineHours.mean,
    loadHours: s.loadHours.mean,
    capacityHours: s.capacityHours.mean,
    busyShare: s.busyShare.mean,
    lostBuyers: s.leftBuyers.mean,
    lostValue: s.leftValue.mean,
    redoShare: s.redoShare.mean,
    autoShare: s.autoShare.mean,
  };
  return { ...reading, cause: causeOf(reading) };
}

export function readAll(projection: Projection): Reading[] {
  return STATION_IDS.map((station) => readStation(projection, station));
}

/** The team where the most money is lost to waiting. Null when nobody is lost anywhere. */
export function worstLoss(readings: readonly Reading[]): Reading | null {
  let worst: Reading | null = null;
  for (const reading of readings) {
    if (reading.lostBuyers < 0.5) continue;
    if (!worst || reading.lostValue > worst.lostValue) worst = reading;
  }
  return worst;
}
