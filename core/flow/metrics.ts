/**
 * Measuring a run. A recorder listens to the engine's events and counts what happened inside a
 * window of working time, the way a company's own systems would: timestamps of each step, who
 * left, who paid. It never reads the process's settings to decide a result.
 */
import type { FlowSim, Item, Listener } from "./engine";

/** Working minutes, from `from` up to but not including `to`. */
export interface Window {
  from: number;
  to: number;
}

export interface StationRun {
  /** First-time arrivals at the station. */
  entered: number;
  /** First-time items a person started. */
  started: number;
  /** Items a person finished, second passes included. */
  handled: number;
  /** Items that needed no person. */
  auto: number;
  /** Items sent back for a second pass. */
  redo: number;
  /** Customers who gave up waiting here; how many of them would have bought, and their value. */
  left: number;
  leftBuyers: number;
  leftValue: number;
  /** Hands-on minutes spent on the items started. */
  touchMinutes: number;
  /** Working minutes of the window during which a person was occupied. */
  busyMinutes: number;
  /** Calendar minutes from entering the station to a person starting, per first-time item. */
  waits: number[];
  /** The same wait, split: the office was closed, nobody had handed it out, it stood in line. */
  closedMinutes: number;
  assignMinutes: number;
  lineMinutes: number;
  /** Items not yet handled at the two ends of the window. */
  backlogStart: number;
  backlogEnd: number;
}

export interface RunStats {
  window: Window;
  requests: number;
  /** Requests from customers who would buy if nobody made them wait, and what they are worth. */
  buyers: number;
  buyerValue: number;
  signed: number;
  signedValue: number;
  /** Customers who paid, and the money that came in. */
  paid: number;
  paidValue: number;
  stations: StationRun[];
  /** Calendar minutes from a request to its first reply. */
  replyMinutes: number[];
  /** Calendar minutes from a request to the payment, and from the signature to the payment. */
  cashMinutes: number[];
  signedToCashMinutes: number[];
}

const emptyStation = (): StationRun => ({
  entered: 0,
  started: 0,
  handled: 0,
  auto: 0,
  redo: 0,
  left: 0,
  leftBuyers: 0,
  leftValue: 0,
  touchMinutes: 0,
  busyMinutes: 0,
  waits: [],
  closedMinutes: 0,
  assignMinutes: 0,
  lineMinutes: 0,
  backlogStart: 0,
  backlogEnd: 0,
});

export class Recorder {
  readonly stats: RunStats;
  private readonly signedAt = new WeakMap<Item, number>();

  constructor(
    private readonly stations: number,
    window: Window,
    /** Index of the station after which a customer counts as signed. */
    private readonly signedAfter: number,
  ) {
    this.stats = {
      window,
      requests: 0,
      buyers: 0,
      buyerValue: 0,
      signed: 0,
      signedValue: 0,
      paid: 0,
      paidValue: 0,
      stations: Array.from({ length: stations }, emptyStation),
      replyMinutes: [],
      cashMinutes: [],
      signedToCashMinutes: [],
    };
  }

  /** Counts what is waiting at each station. Call it when the run reaches each end of the window. */
  snapshot(sim: FlowSim, edge: "start" | "end"): void {
    this.stats.stations.forEach((station, index) => {
      const state = sim.station(index);
      const waiting = state.held.length + state.queue.length;
      if (edge === "start") station.backlogStart = waiting;
      else station.backlogEnd = waiting;
    });
  }

  readonly listen: Listener = (kind, item, index, sim) => {
    const { window } = this.stats;
    const station = this.stats.stations[index];
    if (kind === "start" && station) {
      // Work that started before the window can still occupy a person inside it.
      const overlap = Math.min(item.ends, window.to) - Math.max(item.started, window.from);
      if (overlap > 0) station.busyMinutes += overlap;
    }
    const wall = sim.wall;
    // Remembered for every customer, so the time from signature to payment is known for those
    // who signed before the window opened and paid inside it.
    if (kind === "enter" && index === this.signedAfter + 1) this.signedAt.set(item, wall);
    if (sim.now < window.from || sim.now >= window.to) return;
    const buyer = item.req.exitAfter === this.stations;
    switch (kind) {
      case "arrive":
        this.stats.requests++;
        if (buyer) {
          this.stats.buyers++;
          this.stats.buyerValue += item.req.value;
        }
        if (station) station.entered++;
        return;
      case "enter":
        if (station) station.entered++;
        if (index === this.signedAfter + 1) {
          this.stats.signed++;
          this.stats.signedValue += item.req.value;
        }
        return;
      case "start": {
        if (!station) return;
        const spec = sim.process.stations[index];
        station.touchMinutes += (item.ends - item.started) / (spec?.stretch ?? 1);
        if (item.pass !== 0) return;
        station.started++;
        station.waits.push(wall - item.entered);
        const workable = sim.calendar.wallOfWork(sim.calendar.workOfWall(item.entered));
        station.closedMinutes += workable - item.entered;
        station.assignMinutes += Math.max(0, item.released - workable);
        station.lineMinutes += wall - Math.max(item.released, workable);
        return;
      }
      case "done":
        if (!station) return;
        station.handled++;
        if (index === 0 && item.pass === 0) this.stats.replyMinutes.push(wall - item.req.at);
        return;
      case "auto":
        if (station) station.auto++;
        return;
      case "redo":
        if (station) station.redo++;
        return;
      case "left":
        if (!station) return;
        station.left++;
        if (buyer) {
          station.leftBuyers++;
          station.leftValue += item.req.value;
        }
        return;
      case "paid": {
        this.stats.paid++;
        this.stats.paidValue += item.req.value;
        this.stats.cashMinutes.push(wall - item.req.at);
        const signed = this.signedAt.get(item);
        if (signed !== undefined) this.stats.signedToCashMinutes.push(wall - signed);
        return;
      }
      default:
        return;
    }
  };
}

/** The middle value of a list; 0 for an empty one. */
export function median(values: readonly number[]): number {
  return percentile(values, 0.5);
}

/** The value below which a share `p` of the list falls, interpolating between neighbors. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  // A typed array sorts by value, without a comparison function, and several times faster.
  const sorted = Float64Array.from(values).sort();
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const a = sorted[low] ?? 0;
  const b = sorted[high] ?? a;
  return a + (b - a) * (position - low);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}
