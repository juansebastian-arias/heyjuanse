import { describe, expect, it } from "vitest";
import { CLOSE, DAY, OPEN } from "./calendar";
import { BASE, STATION_IDS } from "./company";
import type { Request } from "./engine";
import { demandFor, isBuyer } from "./requests";
import { assumptionsFor } from "./scenario";

const isWeekend = (day: number) => day % 7 >= 5;

function collect(seed: number, days: number, a = BASE): Request[] {
  const demand = demandFor(seed, a);
  const all: Request[] = [];
  for (let day = 0; day < days; day++) all.push(...demand(day));
  return all;
}

describe("Larkspur's requests", () => {
  it("are the same every time for the same seed, and different for another", () => {
    expect(collect(4, 30)).toEqual(collect(4, 30));
    expect(collect(4, 30).map((r) => r.key)).not.toEqual(collect(5, 30).map((r) => r.key));
  });

  it("do not depend on the order the days are asked for", () => {
    const forward = demandFor(9);
    const backward = demandFor(9);
    const a = [0, 1, 2, 3].map((day) => forward(day));
    const b = [3, 2, 1, 0].map((day) => backward(day)).reverse();
    expect(a).toEqual(b);
  });

  it("fall on their own day, in time order, with ids that say which day", () => {
    const demand = demandFor(2);
    for (let day = 0; day < 60; day++) {
      const requests = demand(day);
      for (const [index, r] of requests.entries()) {
        expect(Math.floor(r.at / DAY)).toBe(day);
        expect(Math.floor(r.id / 1000)).toBe(day);
        if (index > 0) expect(r.at).toBeGreaterThanOrEqual(requests[index - 1]?.at ?? 0);
      }
    }
  });

  it("arrive at the assumed rates, mostly in office hours on weekdays", () => {
    const days = 2800;
    const all = collect(1, days);
    const weekdays = all.filter((r) => !isWeekend(Math.floor(r.at / DAY)));
    const weekend = all.length - weekdays.length;
    expect(weekdays.length / (days * (5 / 7))).toBeCloseTo(BASE.requestsPerWeekday, 0);
    expect(weekend / (days * (2 / 7))).toBeCloseTo(BASE.requestsPerWeekendDay, 0);
    const inHours = weekdays.filter((r) => {
      const minute = r.at % DAY;
      return minute >= OPEN && minute < CLOSE;
    });
    expect(inHours.length / weekdays.length).toBeCloseTo(BASE.officeHoursShare, 1);
  });

  it("split into fits, acceptances and signatures at the assumed shares", () => {
    const all = collect(1, 2800);
    const share = (test: (r: Request) => boolean) => all.filter(test).length / all.length;
    expect(share((r) => r.exitAfter > 0)).toBeCloseTo(BASE.fitShare, 1);
    expect(share((r) => r.exitAfter > 1)).toBeCloseTo(BASE.fitShare * BASE.acceptShare, 1);
    expect(share(isBuyer)).toBeCloseTo(BASE.fitShare * BASE.acceptShare * BASE.signShare, 1);
    for (const r of all) expect([0, 1, 2, STATION_IDS.length]).toContain(r.exitAfter);
  });

  it("have fleets around the assumed median, priced per vehicle", () => {
    const sizes = collect(1, 2800)
      .map((r) => r.size)
      .sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
    expect(Math.abs(median - BASE.vehiclesMedian)).toBeLessThanOrEqual(2);
    expect(sizes[0]).toBeGreaterThanOrEqual(4);
    for (const r of collect(1, 30)) expect(r.value).toBe(r.size * BASE.pricePerVehicle);
  });

  it("carry a name", () => {
    for (const r of collect(3, 20)) expect(r.label).toMatch(/^[A-Z][a-z]+ [A-Z]/);
  });
});

describe("changing an assumption", () => {
  const ids = (requests: readonly Request[]) => new Set(requests.map((r) => r.id));
  const days = 120;

  it("adds requests to the ones already there when volume goes up", () => {
    const fewer = collect(6, days, assumptionsFor({ demand: 10 }));
    const base = collect(6, days);
    const more = collect(6, days, assumptionsFor({ demand: 20 }));
    expect(fewer.length).toBeLessThan(base.length);
    expect(base.length).toBeLessThan(more.length);
    const baseIds = ids(base);
    const moreIds = ids(more);
    for (const r of fewer) expect(baseIds.has(r.id)).toBe(true);
    for (const r of base) expect(moreIds.has(r.id)).toBe(true);
  });

  it("leaves a shared request exactly as it was when volume changes", () => {
    const byId = new Map(collect(6, days, assumptionsFor({ demand: 20 })).map((r) => [r.id, r]));
    for (const r of collect(6, days)) expect(byId.get(r.id)).toEqual(r);
  });

  it("turns some of the same buyers into non-buyers when fewer say yes", () => {
    const base = collect(6, days);
    const fewerYes = collect(6, days, assumptionsFor({ accept: 30 }));
    expect(fewerYes.map((r) => [r.id, r.at, r.size])).toEqual(
      base.map((r) => [r.id, r.at, r.size]),
    );
    const buyers = ids(base.filter(isBuyer));
    const stillBuyers = fewerYes.filter(isBuyer);
    expect(stillBuyers.length).toBeLessThan(buyers.size);
    for (const r of stillBuyers) expect(buyers.has(r.id)).toBe(true);
  });

  it("changes what a customer is worth, and nothing else, when the price changes", () => {
    const base = collect(6, days);
    const pricier = collect(6, days, assumptionsFor({ price: 220 }));
    expect(pricier.map((r) => ({ ...r, value: 0 }))).toEqual(base.map((r) => ({ ...r, value: 0 })));
    for (const r of pricier) expect(r.value).toBe(r.size * 220);
  });
});
