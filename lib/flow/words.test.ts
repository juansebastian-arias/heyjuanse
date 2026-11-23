import { describe, expect, it } from "vitest";
import { BASE, LEVER_IDS, LEVERS, STATION_IDS, STATIONS, TODAY } from "@/core/flow/company";
import { type Cause, causeOf, type Reading } from "@/core/flow/diagnose";
import type { Difference } from "@/core/flow/experiment";
import type { Move, Option, Verdict } from "@/core/flow/planner";
import { duration, hoursPerDay, money } from "./format";
import {
  causeDetail,
  causeHeadline,
  costText,
  KIND_LABEL,
  loadShare,
  lostText,
  moveKind,
  moveMechanism,
  moveName,
  moveWhat,
  peopleText,
  rangeText,
  setupText,
  soFar,
  VERDICT_LABEL,
  verdictText,
} from "./words";

const diff = (mean: number, positive = 1): Difference => ({
  mean,
  low: mean * 0.5,
  high: mean * 1.5,
  positive,
  se: Math.abs(mean) / 10,
});

function option(overrides: Partial<Option> & { verdict: Verdict }): Option {
  return {
    move: { kind: "lever", lever: "routing" },
    setup: TODAY,
    cash: diff(40_000),
    paid: diff(6),
    lostBuyers: diff(-6),
    net: diff(32_000),
    cashDays: diff(0),
    monthly: 100,
    build: 2500,
    paybackMonths: 0.08,
    ...overrides,
  };
}

function reading(parts: Partial<Omit<Reading, "cause">>): Reading {
  const base = {
    station: "reply" as const,
    waitHours: 0,
    closedHours: 0,
    assignHours: 0,
    lineHours: 0,
    loadHours: 4,
    capacityHours: 6,
    busyShare: 0.6,
    lostBuyers: 0,
    lostValue: 0,
    redoShare: 0,
    autoShare: 0,
    ...parts,
  };
  const waitHours = parts.waitHours ?? base.closedHours + base.assignHours + base.lineHours;
  const full = { ...base, waitHours };
  return { ...full, cause: causeOf(full) };
}

describe("naming a change", () => {
  it("names every improvement with the words the company model gives it", () => {
    for (const id of LEVER_IDS) {
      const move: Move = { kind: "lever", lever: id };
      expect(moveName(move)).toBe(LEVERS[id].name);
      expect(moveWhat(move, BASE)).toBe(LEVERS[id].what);
      expect(moveMechanism(move)).toBe(LEVERS[id].mechanism);
      expect(KIND_LABEL[moveKind(move)]).toBeTruthy();
    }
  });

  it("names a hire after the role, with the right article", () => {
    expect(moveName({ kind: "hire", station: "reply" })).toBe("Hire a sales rep");
    expect(moveName({ kind: "hire", station: "quote" })).toBe("Hire an account executive");
    expect(moveName({ kind: "hire", station: "setup" })).toBe("Hire an onboarding specialist");
    for (const station of STATION_IDS) {
      const move: Move = { kind: "hire", station };
      expect(moveKind(move)).toBe("hire");
      expect(moveWhat(move, BASE)).toContain(hoursPerDay(BASE.hoursPerDay[station]));
      expect(moveWhat(move, BASE)).toContain(STATIONS[station].role);
    }
  });

  it("writes a cost with only the parts that are not zero", () => {
    expect(costText(100, 2500)).toBe("$100 a month and $2.5k to build");
    expect(costText(4500, 0)).toBe("$4.5k a month");
    expect(costText(0, 6000)).toBe("$6k to build");
    expect(costText(0, 0)).toBe("nothing");
  });
});

describe("saying whether a change pays", () => {
  it("states the gain after cost and a coarse payback when it nearly always pays", () => {
    expect(verdictText(option({ verdict: "worth" }))).toBe(
      "+$32k a month after its own cost. Repays what it costs to build within a month.",
    );
  });

  it("says how often it comes out ahead when the average hides losing quarters", () => {
    const text = verdictText(
      option({ verdict: "worth", net: diff(2700, 0.68), build: 0, paybackMonths: null }),
    );
    expect(text).toBe("+$2.7k a month after its own cost on average: ahead in 7 of 10 quarters.");
  });

  it("claims no payback for a change with nothing to build", () => {
    const text = verdictText(option({ verdict: "worth", build: 0, paybackMonths: null }));
    expect(text).toBe("+$32k a month after its own cost.");
  });

  it("gives no figure for a gain that cannot be told from luck", () => {
    const text = verdictText(option({ verdict: "unclear", net: diff(900, 0.55) }));
    expect(text).not.toMatch(/\$/);
    expect(text).toContain("luck");
  });

  it("shows the loss of a change that costs more than it brings in", () => {
    const text = verdictText(option({ verdict: "costs more", net: diff(-6100, 0.05) }));
    expect(text).toBe("−$6.1k a month after its own cost.");
  });

  it("has a label for every verdict", () => {
    for (const verdict of ["worth", "unclear", "costs more"] as const) {
      expect(VERDICT_LABEL[verdict].length).toBeGreaterThan(5);
    }
  });

  it("writes a range as the span eight quarters in ten fall inside", () => {
    expect(rangeText(304_000, 399_000, money)).toBe("$304k to $399k in 8 of 10 quarters");
  });
});

describe("explaining a wait", () => {
  // One reading per cause, each with the numbers that make the rule in diagnose.ts choose it.
  const cases: Array<[Cause, Reading]> = [
    ["handout", reading({ assignHours: 16.6, closedHours: 3.9, lineHours: 3.6, loadHours: 5.9 })],
    ["overload", reading({ lineHours: 46, loadHours: 26.2, capacityHours: 24, station: "quote" })],
    ["full", reading({ lineHours: 20, loadHours: 5.8, capacityHours: 6 })],
    [
      "tight",
      reading({
        lineHours: 11,
        closedHours: 2,
        loadHours: 21,
        capacityHours: 24,
        station: "quote",
      }),
    ],
    ["hours", reading({ closedHours: 3.2, lineHours: 0.2, loadHours: 2, capacityHours: 6 })],
    ["turn", reading({ lineHours: 9.6, loadHours: 1.1, capacityHours: 1.5, station: "invoice" })],
    ["clear", reading({ lineHours: 0.3, loadHours: 2, capacityHours: 14, station: "setup" })],
  ];

  it.each(cases)("%s: the sentence is built from the reading's own numbers", (cause, r) => {
    expect(r.cause).toBe(cause);
    const headline = causeHeadline(r);
    const detail = causeDetail(r, BASE);
    expect(headline.endsWith(".")).toBe(true);
    expect(detail.endsWith(".")).toBe(true);
    // Every explanation that talks about capacity quotes the two figures it compares.
    if (cause !== "handout") {
      expect(detail).toContain(hoursPerDay(r.loadHours));
      expect(detail).toContain(hoursPerDay(r.capacityHours));
    }
  });

  it("the hand-out sentence adds up: the wait, and the part of it spent unassigned", () => {
    const r = cases[0]?.[1];
    if (!r) throw new Error("missing case");
    const detail = causeDetail(r, BASE);
    expect(detail).toContain(duration(r.waitHours));
    expect(detail).toContain(duration(r.assignHours));
    expect(detail).toContain("once a day, at 9:00");
    expect(causeDetail(r, { ...BASE, handoutsPerDay: 3 })).toContain("3 times a day");
  });

  it("never says a team has spare time when its work exceeds its hours", () => {
    for (const [, r] of cases) {
      const text = `${causeHeadline(r)} ${causeDetail(r, BASE)}`;
      if (loadShare(r) >= 1) expect(text).not.toMatch(/to spare|keeps up/);
      if (loadShare(r) < 0.8) expect(text).not.toMatch(/More work arrives/);
    }
  });

  it("explains a slow part-time desk by the hours it gives the work", () => {
    const r = cases[5]?.[1];
    if (!r) throw new Error("missing case");
    expect(causeDetail(r, BASE)).toContain(hoursPerDay(BASE.hoursPerDay.invoice));
  });
});

describe("small phrases", () => {
  it("writes what is lost at a team, or that nothing is", () => {
    expect(lostText(reading({ lostBuyers: 19.5, lostValue: 136_000 }))).toBe(
      "20 a month, worth $136k",
    );
    expect(lostText(reading({ lostBuyers: 0.01, lostValue: 40 }))).toBe("none");
  });

  it("counts people and changes in plain words", () => {
    expect(peopleText(1)).toBe("1 person");
    expect(peopleText(4)).toBe("4 people");
    expect(setupText(TODAY)).toBe("no changes");
    expect(setupText({ on: ["routing"], extra: {} })).toBe("1 change");
    expect(setupText({ on: ["routing", "autoApprove"], extra: { quote: 1 } })).toBe(
      "2 changes and 1 hire",
    );
    expect(setupText({ on: [], extra: { quote: 2, reply: 1 } })).toBe("3 hires");
  });
});

describe("reporting what the changes so far came to", () => {
  const today = { cash: 350_000, lostBuyers: 22 };
  /** A difference far too small to tell from luck: its error is as large as it is. */
  const noise = (mean: number): Difference => ({ ...diff(mean), se: Math.abs(mean) });

  it("names both figures when both clearly moved", () => {
    const now = { cash: 390_400, lostBuyers: 15.6 };
    expect(soFar(today, now, { cash: diff(40_400), lostBuyers: diff(-6.4) })).toEqual({
      cash: { now: "$390k", was: "$350k" },
      lost: { now: "16", was: "22", noun: "buyers" },
    });
  });

  it("leaves out a figure whose difference could be luck", () => {
    const now = { cash: 356_000, lostBuyers: 15.6 };
    const result = soFar(today, now, { cash: noise(6_000), lostBuyers: diff(-6.4) });
    expect(result.cash).toBeNull();
    expect(result.lost).toEqual({ now: "16", was: "22", noun: "buyers" });
    expect(soFar(today, now, { cash: noise(6_000), lostBuyers: noise(-6.4) })).toEqual({
      cash: null,
      lost: null,
    });
  });

  it("leaves out a difference that rounding makes invisible", () => {
    // Clear by the statistics, but both sides print as the same figure.
    const now = { cash: 350_300, lostBuyers: 21.6 };
    expect(soFar(today, now, { cash: diff(300), lostBuyers: diff(-0.4) })).toEqual({
      cash: null,
      lost: null,
    });
  });

  it("counts one buyer as one", () => {
    const now = { cash: 470_000, lostBuyers: 1 };
    expect(soFar(today, now, { cash: diff(120_000), lostBuyers: diff(-21) }).lost).toEqual({
      now: "1",
      was: "22",
      noun: "buyer",
    });
  });
});
