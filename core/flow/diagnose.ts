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
  /** The team keeps up on average but has too little slack to absorb a busy day. */
  | "tight"
  /** The wait is nights and weekends. */
  | "hours"
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
/** Load as a share of capacity from which a team counts as overloaded, and as tight. */
const OVERLOAD = 0.98;
const TIGHT = 0.85;

export function causeOf(reading: Omit<Reading, "cause">): Cause {
  const { assignHours, closedHours, lineHours, loadHours, capacityHours } = reading;
  if (assignHours >= NOTICEABLE_HOURS && assignHours >= Math.max(closedHours, lineHours)) {
    return "handout";
  }
  const use = capacityHours > 0 ? loadHours / capacityHours : 0;
  if (use >= OVERLOAD) return "overload";
  if (use >= TIGHT && lineHours >= NOTICEABLE_HOURS) return "tight";
  if (closedHours >= NOTICEABLE_HOURS && closedHours >= lineHours) return "hours";
  return "clear";
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
