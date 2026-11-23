import { afterEach, describe, expect, it, vi } from "vitest";
import { type Setup, setupKey, TODAY, withLever } from "@/core/flow/company";
import { demands, difference, runMany, type Summary } from "@/core/flow/experiment";
import { type Evaluate, evaluateMove, movesFrom, optionsFrom, planFrom } from "@/core/flow/planner";
import { assumptionsFor, START, TWEAK_IDS, type Tweaks } from "@/core/flow/scenario";
import { Pool } from "./pool";
import { FlowStore } from "./store";
import { outcomeOf, pendingView, type View } from "./view";

// Few quarters per setup keep these tests quick. With so few, hardly any change is "clearly
// worth it", which does not matter here: the store must match the planner whatever it decides.
const COUNT = 4;
const ROUTING = withLever(TODAY, "routing", true);
const BOTH = withLever(ROUTING, "autoApprove", true);

/** The same quarters the store asks its pool for, computed directly. */
function direct(tweaks: Tweaks = {}): Evaluate {
  const a = assumptionsFor(tweaks);
  const streams = demands(COUNT, a);
  const cache = new Map<string, Summary[]>();
  return (setup: Setup) => {
    const key = setupKey(setup);
    let runs = cache.get(key);
    if (!runs) {
      runs = runMany(setup, streams, a);
      cache.set(key, runs);
    }
    return runs;
  };
}

/** Resolves with the view once the store has nothing left to work out for it. */
function settled(store: FlowStore): Promise<View> {
  return new Promise((resolve) => {
    const check = () => {
      const view = store.getView();
      if (view.error || (view.planDone && view.options)) {
        unsubscribe();
        resolve(view);
      }
    };
    const unsubscribe = store.subscribe(check);
    check();
  });
}

const stores: FlowStore[] = [];
function storeFrom(view: View = pendingView(START)): FlowStore {
  const store = new FlowStore(view, COUNT);
  stores.push(store);
  return store;
}

afterEach(() => {
  for (const store of stores.splice(0)) store.dispose();
  vi.restoreAllMocks();
});

describe("the page's store", () => {
  it("works a change out in stages: the result, then the options, then the plan", async () => {
    const store = storeFrom();
    const stages: string[] = [];
    store.subscribe(() => {
      const view = store.getView();
      const stage = !view.outcome
        ? "waiting"
        : !view.options
          ? "result"
          : view.planDone
            ? "plan"
            : "options";
      if (stages[stages.length - 1] !== stage) stages.push(stage);
    });
    store.setScenario({ setup: ROUTING, tweaks: {} });
    await settled(store);
    expect(stages).toEqual(["waiting", "result", "options", "plan"]);
  });

  it("ends with exactly the numbers the model gives when asked directly", async () => {
    const store = storeFrom();
    store.setScenario({ setup: ROUTING, tweaks: {} });
    const view = await settled(store);
    const evaluate = direct();
    const expected = outcomeOf(ROUTING, evaluate(TODAY), evaluate(ROUTING));
    expect(view.error).toBeNull();
    expect(view.outcome).toEqual(expected);
    expect(view.today).toEqual(outcomeOf(TODAY, evaluate(TODAY), evaluate(TODAY)).now);
    expect(view.options).toEqual(optionsFrom(ROUTING, evaluate));
    expect(view.options).toHaveLength(movesFrom(ROUTING).length);
    expect(view.plan).toEqual(planFrom(ROUTING, evaluate));
    expect(view.outcome?.now.runs).toBe(COUNT);
  });

  it("uses the visitor's assumptions for today's company and for the changed one", async () => {
    const tweaks = { patience: 4, price: 220 };
    const store = storeFrom();
    store.setScenario({ setup: ROUTING, tweaks });
    const view = await settled(store);
    const evaluate = direct(tweaks);
    const a = assumptionsFor(tweaks);
    expect(view.outcome).toEqual(outcomeOf(ROUTING, evaluate(TODAY), evaluate(ROUTING), a));
    expect(view.options).toEqual(optionsFrom(ROUTING, evaluate, a));
  });

  it("does nothing when asked for the scenario already on screen", async () => {
    const store = storeFrom();
    store.setScenario({ setup: ROUTING, tweaks: {} });
    await settled(store);
    const listener = vi.fn();
    store.subscribe(listener);
    store.setScenario({ setup: withLever(TODAY, "routing", true), tweaks: {} });
    expect(listener).not.toHaveBeenCalled();
  });

  it("lets the newest change win: nothing from an abandoned one is ever shown", async () => {
    const store = storeFrom();
    const seen: string[] = [];
    store.setScenario({ setup: ROUTING, tweaks: {} });
    store.subscribe(() => {
      const view = store.getView();
      if (view.outcome) seen.push(setupKey(view.scenario.setup));
    });
    store.setScenario({ setup: BOTH, tweaks: {} });
    const view = await settled(store);
    expect(new Set(seen)).toEqual(new Set([setupKey(BOTH)]));
    const evaluate = direct();
    expect(view.outcome).toEqual(outcomeOf(BOTH, evaluate(TODAY), evaluate(BOTH)));
  });

  it("is not left waiting when a change needs quarters that a newer change had just dropped", async () => {
    const store = storeFrom();
    // ROUTING's quarters are queued behind today's; the next change drops them from the queue;
    // the third asks for ROUTING again before anyone has heard that they were dropped.
    store.setScenario({ setup: ROUTING, tweaks: {} });
    store.setScenario({ setup: BOTH, tweaks: {} });
    store.setScenario({ setup: ROUTING, tweaks: {} });
    const view = await settled(store);
    const evaluate = direct();
    expect(view.error).toBeNull();
    expect(view.outcome).toEqual(outcomeOf(ROUTING, evaluate(TODAY), evaluate(ROUTING)));
    expect(view.options).toEqual(optionsFrom(ROUTING, evaluate));
  });

  it("handles a click that lands while the page is still looking one step ahead", async () => {
    const evaluate = direct();
    const one = evaluateMove(TODAY, { kind: "lever", lever: "routing" }, evaluate);
    const today = outcomeOf(TODAY, evaluate(TODAY), evaluate(TODAY));
    const store = storeFrom({
      ...pendingView(START),
      today: today.now,
      todayReadings: today.readings,
      outcome: today,
      options: optionsFrom(TODAY, evaluate),
      plan: [one],
      planDone: true,
    });
    const runs = vi.spyOn(Pool.prototype, "runs");
    store.warm();
    // Once the look-ahead has asked for the options of the next step, they sit in the queue.
    while (runs.mock.calls.length < 3) await new Promise((resolve) => setTimeout(resolve, 1));
    store.setScenario({ setup: one.setup, tweaks: {} });
    const view = await settled(store);
    expect(view.error).toBeNull();
    expect(view.outcome).toEqual(outcomeOf(one.setup, evaluate(TODAY), evaluate(one.setup)));
    expect(view.options).toEqual(optionsFrom(one.setup, evaluate));
  });

  it("simulates nothing twice: going back to a setup already seen asks the workers for nothing", async () => {
    const store = storeFrom();
    store.setScenario({ setup: ROUTING, tweaks: {} });
    const first = await settled(store);
    store.setScenario({ setup: BOTH, tweaks: {} });
    await settled(store);
    const runs = vi.spyOn(Pool.prototype, "runs");
    store.setScenario({ setup: ROUTING, tweaks: {} });
    const again = await settled(store);
    expect(runs).not.toHaveBeenCalled();
    expect(again.outcome).toEqual(first.outcome);
    expect(again.plan).toEqual(first.plan);
  });

  it("keeps the rest of the plan when the visitor follows it, one step or several at once", () => {
    const evaluate = direct();
    const one = evaluateMove(TODAY, { kind: "lever", lever: "routing" }, evaluate);
    const two = evaluateMove(one.setup, { kind: "lever", lever: "quoteDrafts" }, evaluate);
    const three = evaluateMove(two.setup, { kind: "lever", lever: "autoApprove" }, evaluate);
    const start: View = { ...pendingView(START), plan: [one, two, three], planDone: true };

    const next = storeFrom(start);
    next.setScenario({ setup: one.setup, tweaks: {} });
    expect(next.getView().plan).toEqual([two, three]);
    expect(next.getView().planDone).toBe(true);

    const jump = storeFrom(start);
    jump.setScenario({ setup: three.setup, tweaks: {} });
    expect(jump.getView().plan).toEqual([]);
    expect(jump.getView().planDone).toBe(true);

    const elsewhere = storeFrom(start);
    elsewhere.setScenario({ setup: withLever(TODAY, "billingSync", true), tweaks: {} });
    expect(elsewhere.getView().plan).toEqual([]);
    expect(elsewhere.getView().planDone).toBe(false);

    // Under other assumptions the old plan says nothing about the new company.
    const assumed = storeFrom(start);
    assumed.setScenario({ setup: one.setup, tweaks: { demand: 18 } });
    expect(assumed.getView().planDone).toBe(false);
    expect(assumed.getView().today).toBeNull();
  });

  it("says so when a simulation fails, and recovers when asked to try again", async () => {
    const store = storeFrom();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const runs = vi.spyOn(Pool.prototype, "runs").mockRejectedValueOnce(new Error("no workers"));
    store.setScenario({ setup: ROUTING, tweaks: {} });
    const failed = await settled(store);
    expect(failed.error).toBe("no workers");
    expect(quiet).toHaveBeenCalled();
    runs.mockRestore();
    store.retry();
    expect(store.getView().error).toBeNull();
    const view = await settled(store);
    expect(view.error).toBeNull();
    const evaluate = direct();
    expect(view.outcome).toEqual(outcomeOf(ROUTING, evaluate(TODAY), evaluate(ROUTING)));
  });

  it("measures how far a result moves with each assumption, on the same customers", async () => {
    const store = storeFrom();
    const progress: number[] = [];
    const swings = await store.sensitivity(ROUTING, {}, (share) => progress.push(share));
    expect(swings.map((swing) => swing.tweak).sort()).toEqual([...TWEAK_IDS].sort());
    const gain = (tweaks: Tweaks) => {
      const evaluate = direct(tweaks);
      return difference(evaluate(TODAY), evaluate(ROUTING), "cash").mean;
    };
    for (const swing of swings) {
      expect(swing.base).toBeCloseTo(gain({}), 6);
      if (swing.low)
        expect(swing.low.result).toBeCloseTo(gain({ [swing.tweak]: swing.low.value }), 6);
      if (swing.high) {
        expect(swing.high.result).toBeCloseTo(gain({ [swing.tweak]: swing.high.value }), 6);
      }
    }
    // Widest first, and progress only ever moves forward, to exactly done.
    const spreads = swings.map((swing) => swing.spread);
    expect(spreads).toEqual([...spreads].sort((x, y) => y - x));
    expect(progress).toEqual([...progress].sort((x, y) => x - y));
    expect(progress[progress.length - 1]).toBe(1);
  });

  it("stops publishing once it is disposed", async () => {
    const store = storeFrom();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setScenario({ setup: ROUTING, tweaks: {} });
    const calls = listener.mock.calls.length;
    store.dispose();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listener.mock.calls.length).toBe(calls);
  });
});
