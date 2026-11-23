import { describe, expect, it } from "vitest";
import { WORK_DAY } from "@/core/flow/calendar";
import { STATION_INDEX, TODAY, withLever } from "@/core/flow/company";
import { demands, project, QUARTER_DAYS, runMany } from "@/core/flow/experiment";
import { START } from "@/core/flow/scenario";
import { COUNTED_AT_OPENING, Live } from "./live";

/** Working days in the month the projections report per. */
const MONTH_DAYS = QUARTER_DAYS / 3;
const perMonth = (counted: number, days: number) => (counted * MONTH_DAYS) / days;

describe("the live floor", () => {
  it("opens mid-morning on a working day, with four weeks already counted", () => {
    const live = new Live(START);
    expect(live.daysCounted).toBeCloseTo(COUNTED_AT_OPENING, 6);
    const minuteOfDay = live.wall % (24 * 60);
    expect(minuteOfDay).toBe(10 * 60 + 30);
    const weekday = Math.floor(live.wall / (24 * 60)) % 7;
    expect(weekday).toBeLessThan(5);
  });

  it("shows a first month close to the long-run averages printed under it", () => {
    // The floor is one stream of customers; the figures under it average many quarters. The
    // stream was chosen so that the two agree at a glance. This holds it to that.
    const live = new Live(START);
    const long = project(runMany(TODAY, demands(40))).totals;
    const cash = perMonth(live.tallies.paidValue, live.daysCounted);
    const lost = perMonth(
      live.tallies.leftBuyers.reduce((sum, value) => sum + value, 0),
      live.daysCounted,
    );
    expect(cash / long.cash.mean).toBeGreaterThan(0.9);
    expect(cash / long.cash.mean).toBeLessThan(1.1);
    expect(lost / long.lostBuyers.mean).toBeGreaterThan(0.85);
    expect(lost / long.lostBuyers.mean).toBeLessThan(1.15);
  });

  it("loses most of its buyers where the page says it does: waiting for a first reply", () => {
    const { leftBuyers } = new Live(START).tallies;
    const total = leftBuyers.reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThan(10);
    expect((leftBuyers[STATION_INDEX.reply] ?? 0) / total).toBeGreaterThan(0.75);
  });

  it("counts every departure it reports, and only would-be buyers as buyers", () => {
    const live = new Live(START);
    live.departures = [];
    const before = structuredClone(live.tallies);
    live.advance(10 * WORK_DAY);
    const left = live.departures.filter((departure) => departure.kind === "left");
    const paid = live.departures.filter((departure) => departure.kind === "paid");
    const sum = (list: number[]) => list.reduce((total, value) => total + value, 0);
    expect(sum(live.tallies.left) - sum(before.left)).toBe(left.length);
    expect(sum(live.tallies.leftBuyers) - sum(before.leftBuyers)).toBe(
      left.filter((departure) => departure.buyer).length,
    );
    expect(live.tallies.paid - before.paid).toBe(paid.length);
    expect(live.tallies.paidValue - before.paidValue).toBe(
      paid.reduce((total, departure) => total + departure.item.req.value, 0),
    );
    // Nobody pays without being a buyer.
    expect(paid.every((departure) => departure.buyer)).toBe(true);
  });

  it("reaches the same state whether time passes in frames or in one jump", () => {
    const smooth = new Live(START);
    const jump = new Live(START);
    for (let frame = 0; frame < 5 * WORK_DAY; frame += 7) smooth.advance(7);
    jump.advance(smooth.now - jump.now);
    expect(smooth.now).toBe(jump.now);
    expect(smooth.tallies).toEqual(jump.tallies);
    expect(smooth.sim.items.size).toBe(jump.sim.items.size);
  });

  it("starts counting afresh when the company changes, and loses fewer buyers after", () => {
    const live = new Live(START);
    const lostBefore = live.tallies.leftBuyers[STATION_INDEX.reply] ?? 0;
    live.apply(withLever(TODAY, "routing", true));
    expect(live.daysCounted).toBe(0);
    expect(live.tallies.paid).toBe(0);
    live.advance(COUNTED_AT_OPENING * WORK_DAY);
    expect(live.daysCounted).toBeCloseTo(COUNTED_AT_OPENING, 6);
    const lostAfter = live.tallies.leftBuyers[STATION_INDEX.reply] ?? 0;
    expect(lostAfter).toBeLessThan(lostBefore * 0.7);
  });

  it("is the same floor for every visitor", () => {
    const one = new Live(START);
    const other = new Live(START);
    expect(one.tallies).toEqual(other.tallies);
    expect(one.wall).toBe(other.wall);
  });

  it("follows the visitor's assumptions", () => {
    const busier = new Live({ setup: TODAY, tweaks: { demand: 20 } });
    const usual = new Live(START);
    expect(busier.assumptions.requestsPerWeekday).toBe(20);
    const all = (live: Live) => live.tallies.left.reduce((sum, value) => sum + value, 0);
    expect(all(busier)).toBeGreaterThan(all(usual));
  });
});
