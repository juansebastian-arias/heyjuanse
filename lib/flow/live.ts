/**
 * The company running live: one stream of customers, simulated as the visitor watches. It is the
 * same engine and the same model as the projections, run forward in small steps of time instead
 * of a quarter at once, so what moves on the screen is the model's actual state.
 */
import { WORK_DAY } from "@/core/flow/calendar";
import { type Assumptions, resolve, type Setup, STATION_IDS } from "@/core/flow/company";
import { FlowSim, type Item } from "@/core/flow/engine";
import { WARMUP_DAYS } from "@/core/flow/experiment";
import { demandFor, isBuyer } from "@/core/flow/requests";
import { assumptionsFor, type Scenario } from "@/core/flow/scenario";

/**
 * The stream of customers shown on the floor, the same one for everyone. Every seed is a fair draw
 * from the same model. This one is used because its first four weeks land close to the long-run
 * averages, so the floor's first glance and the projections under it tell the same story;
 * live.test.ts holds it to that.
 */
export const LIVE_SEED = 3;

/**
 * Working days already counted when the floor opens. The first glance then shows four weeks of
 * outcomes (who paid, who gave up and where) instead of an empty count that fills up slowly.
 */
export const COUNTED_AT_OPENING = 20;

/**
 * The floor opens on a Tuesday at 10:30: the warm-up the projections use, the four counted weeks,
 * one more day and ninety minutes.
 */
const OPENING = (WARMUP_DAYS + COUNTED_AT_OPENING + 1) * WORK_DAY + 90;

/** A request leaving the process, for the screen to animate. */
export interface Departure {
  item: Item;
  kind: "left" | "exit" | "paid";
  station: number;
  /** Whether this customer would have bought if nobody had made them wait. */
  buyer: boolean;
}

export interface Tallies {
  /** Working minute the count started. */
  since: number;
  /** Per station: everyone who gave up waiting, and the would-be buyers among them. */
  left: number[];
  leftBuyers: number[];
  paid: number;
  paidValue: number;
}

const stations = STATION_IDS.length;

function emptyTallies(since: number): Tallies {
  return {
    since,
    left: new Array<number>(stations).fill(0),
    leftBuyers: new Array<number>(stations).fill(0),
    paid: 0,
    paidValue: 0,
  };
}

export class Live {
  readonly sim: FlowSim;
  readonly assumptions: Assumptions;
  /** Departures since the screen last collected them. */
  departures: Departure[] = [];
  tallies: Tallies;

  constructor(scenario: Scenario) {
    this.assumptions = assumptionsFor(scenario.tweaks);
    this.sim = new FlowSim(
      resolve(scenario.setup, this.assumptions),
      demandFor(LIVE_SEED, this.assumptions),
    );
    this.sim.advanceTo(OPENING - COUNTED_AT_OPENING * WORK_DAY);
    this.tallies = emptyTallies(this.sim.now);
    this.sim.on((kind, item, station) => {
      if (kind !== "left" && kind !== "exit" && kind !== "paid") return;
      const buyer = isBuyer(item.req);
      this.departures.push({ item, kind, station, buyer });
      if (kind === "left") {
        this.tallies.left[station] = (this.tallies.left[station] ?? 0) + 1;
        if (buyer) this.tallies.leftBuyers[station] = (this.tallies.leftBuyers[station] ?? 0) + 1;
      } else if (kind === "paid") {
        this.tallies.paid++;
        this.tallies.paidValue += item.req.value;
      }
    });
    this.sim.advanceTo(OPENING);
  }

  /** Working minutes since the start of the simulation. */
  get now(): number {
    return this.sim.now;
  }

  /** The calendar minute of the current instant. */
  get wall(): number {
    return this.sim.wall;
  }

  /** Working days counted in the tallies. */
  get daysCounted(): number {
    return (this.sim.now - this.tallies.since) / WORK_DAY;
  }

  /** Moves the company forward by a number of working minutes. */
  advance(minutes: number): void {
    if (minutes > 0) this.sim.advanceTo(this.sim.now + minutes);
  }

  /** Changes how the company works from this instant, and starts counting afresh. */
  apply(setup: Setup): void {
    this.sim.setProcess(resolve(setup, this.assumptions));
    this.tallies = emptyTallies(this.sim.now);
  }
}
