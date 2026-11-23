import { describe, expect, it } from "vitest";
import {
  BASE,
  costOf,
  LEVER_IDS,
  LEVERS,
  type LeverId,
  MAX_EXTRA_PEOPLE,
  type Setup,
  STATION_IDS,
  setupKey,
  TODAY,
  withExtra,
  withLever,
} from "./company";
import { demands, runMany, type Summary, TOTAL_KEYS } from "./experiment";
import { mean } from "./metrics";
import {
  applyMove,
  bestOf,
  type Evaluate,
  evaluateMove,
  type Move,
  moveKey,
  moveStation,
  movesFrom,
  optionsFrom,
  planFrom,
  rank,
  verdictOf,
} from "./planner";

const lever = (id: LeverId): Move => ({ kind: "lever", lever: id });

describe("moves", () => {
  it("offers every improvement and one more person per team from the starting point", () => {
    const moves = movesFrom(TODAY);
    expect(moves).toHaveLength(LEVER_IDS.length + STATION_IDS.length);
    expect(new Set(moves.map(moveKey)).size).toBe(moves.length);
  });

  it("stops offering what is already on, and people beyond the limit", () => {
    let setup = withLever(TODAY, "routing", true);
    setup = withExtra(setup, "quote", MAX_EXTRA_PEOPLE);
    const keys = movesFrom(setup).map(moveKey);
    expect(keys).not.toContain("lever:routing");
    expect(keys).not.toContain("hire:quote");
    expect(keys).toContain("hire:reply");
  });

  it("applies a move without touching the setup it started from", () => {
    const start = withExtra(TODAY, "setup", 1);
    const next = applyMove(
      applyMove(start, { kind: "hire", station: "setup" }),
      lever("billingSync"),
    );
    expect(setupKey(next)).toBe("billingSync|setup:2");
    expect(setupKey(start)).toBe("|setup:1");
  });

  it("knows which team each move changes", () => {
    for (const id of LEVER_IDS) expect(moveStation(lever(id))).toBe(LEVERS[id].station);
    expect(moveStation({ kind: "hire", station: "invoice" })).toBe("invoice");
  });

  it("names a setup the same way whatever order the choices were made in", () => {
    const a = withLever(withLever(TODAY, "selfServe", true), "routing", true);
    const b = withLever(withLever(TODAY, "routing", true), "selfServe", true);
    expect(setupKey(a)).toBe(setupKey(b));
    expect(setupKey(withLever(a, "routing", false))).toBe(
      setupKey(withLever(TODAY, "selfServe", true)),
    );
  });
});

/** Simulated quarters with chosen cash figures, for testing the arithmetic without the engine. */
function fake(setup: Setup, cash: readonly number[]): Summary[] {
  return cash.map((value) => {
    const totals = Object.fromEntries(TOTAL_KEYS.map((key) => [key, 0])) as Summary["totals"];
    totals.cash = value;
    totals.net = value * BASE.margin - costOf(setup).monthly;
    return { totals, stations: {} as Summary["stations"] };
  });
}

describe("judging one move", () => {
  const before = [100_000, 110_000, 90_000, 105_000];

  function judged(move: Move, after: readonly number[]) {
    const evaluate: Evaluate = (setup) =>
      fake(setup, setupKey(setup) === setupKey(TODAY) ? before : after);
    return evaluateMove(TODAY, move, evaluate);
  }

  it("counts the margin on the extra cash, minus what the move costs to run", () => {
    const option = judged(
      lever("routing"),
      before.map((value) => value + 10_000),
    );
    expect(option.cash.mean).toBeCloseTo(10_000, 6);
    expect(option.monthly).toBe(LEVERS.routing.monthly);
    expect(option.build).toBe(LEVERS.routing.setup);
    expect(option.net.mean).toBeCloseTo(10_000 * BASE.margin - LEVERS.routing.monthly, 6);
    expect(option.verdict).toBe("worth");
    expect(option.paybackMonths).toBeCloseTo(LEVERS.routing.setup / option.net.mean, 9);
  });

  it("says a hire costs more than it brings when the extra cash does not cover the salary", () => {
    const option = judged(
      { kind: "hire", station: "quote" },
      before.map((value) => value + 2_000),
    );
    expect(option.monthly).toBe(BASE.monthlyCost.quote);
    expect(option.build).toBe(0);
    expect(option.verdict).toBe("costs more");
    expect(option.paybackMonths).toBeNull();
  });

  it("calls a difference that changes sign from quarter to quarter unclear", () => {
    const option = judged(lever("autoApprove"), [108_000, 101_000, 97_000, 96_000]);
    expect(option.verdict).toBe("unclear");
    expect(option.paybackMonths).toBeNull();
  });

  it("decides the verdict from the gain after costs and how sure it is", () => {
    expect(verdictOf({ mean: 5, low: 1, high: 9, positive: 1, se: 1 })).toBe("worth");
    expect(verdictOf({ mean: -5, low: -9, high: -1, positive: 0, se: 1 })).toBe("costs more");
    expect(verdictOf({ mean: 5, low: -9, high: 19, positive: 0.6, se: 4 })).toBe("unclear");
  });
});

describe("the plan", () => {
  const streams = demands(16);
  const cache = new Map<string, Summary[]>();
  const evaluate: Evaluate = (setup) => {
    const key = setupKey(setup);
    let runs = cache.get(key);
    if (!runs) {
      runs = runMany(setup, streams);
      cache.set(key, runs);
    }
    return runs;
  };
  const net = (setup: Setup) => mean(evaluate(setup).map((summary) => summary.totals.net));
  const options = optionsFrom(TODAY, evaluate);
  const plan = planFrom(TODAY, evaluate);

  it("ranks the open moves by what they leave after costs", () => {
    expect(options).toHaveLength(movesFrom(TODAY).length);
    for (let i = 1; i < options.length; i++) {
      expect(options[i]?.net.mean).toBeLessThanOrEqual(options[i - 1]?.net.mean ?? 0);
    }
    expect(rank([...options].reverse())).toEqual(options);
  });

  it("starts by assigning requests on arrival, which is where the buyers are lost today", () => {
    expect(bestOf(options)?.move).toEqual(lever("routing"));
    expect(plan[0]?.move).toEqual(lever("routing"));
  });

  it("only takes steps that are clearly worth their cost, each from where the last one ended", () => {
    expect(plan.length).toBeGreaterThanOrEqual(3);
    let current = TODAY;
    for (const step of plan) {
      expect(step.verdict).toBe("worth");
      expect(step.net.mean).toBeGreaterThan(0);
      expect(setupKey(step.setup)).toBe(setupKey(applyMove(current, step.move)));
      current = step.setup;
    }
  });

  it("stops when nothing left is clearly worth it", () => {
    const end = plan[plan.length - 1]?.setup ?? TODAY;
    expect(bestOf(optionsFrom(end, evaluate))).toBeNull();
  });

  it("ends within a few percent of the best of all 64 combinations of improvements", () => {
    let best = Number.NEGATIVE_INFINITY;
    for (let mask = 0; mask < 2 ** LEVER_IDS.length; mask++) {
      const setup = LEVER_IDS.reduce(
        (current, id, bit) => (mask & (1 << bit) ? withLever(current, id, true) : current),
        TODAY,
      );
      best = Math.max(best, net(setup));
    }
    const reached = net(plan[plan.length - 1]?.setup ?? TODAY);
    expect(reached).toBeGreaterThan(net(TODAY));
    expect(reached).toBeGreaterThanOrEqual(best * 0.97);
  });
});
