/**
 * The page's state: the scenario the visitor has chosen and the numbers that go with it.
 *
 * Changing the scenario never blocks. The store asks the worker pool for the simulated quarters
 * it needs, publishes each part of the view as it becomes available (the setup itself, then the
 * options from it, then the plan step by step) and drops work that a newer change has made
 * pointless. Quarters are kept by scenario, so going back to a setup already seen is instant.
 *
 * While the page is idle the store looks one step ahead: it simulates what the recommended next
 * move would lead to, so that taking it shows its result at once.
 */
import { type Setup, setupKey, TODAY } from "@/core/flow/company";
import { difference, type Summary } from "@/core/flow/experiment";
import {
  applyMove,
  bestOf,
  type Evaluate,
  movesFrom,
  type Option,
  optionsFrom,
} from "@/core/flow/planner";
import { assumptionsFor, type Scenario, type Tweaks, tweaksKey } from "@/core/flow/scenario";
import { type Swing, swings, variations } from "@/core/flow/sensitivity";
import type { Check } from "@/core/flow/validate";
import { Cancelled, Pool, type Ticket } from "./pool";
import { outcomeOf, pendingView, RUNS, type View } from "./view";

type Listener = () => void;

const CHECK_CUSTOMERS = 100_000;

export class FlowStore {
  private view: View;
  private readonly listeners = new Set<Listener>();
  private readonly quarters = new Map<string, { promise: Promise<Summary[]>; ticket: Ticket }>();
  private readonly settled = new Map<string, Summary[]>();
  private pool: Pool | null = null;
  private generation = 0;

  constructor(
    private readonly initial: View,
    /** Quarters simulated per setup. The page uses the same number as the first screen. */
    private readonly count = RUNS,
  ) {
    this.view = initial;
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getView = (): View => this.view;
  readonly getInitialView = (): View => this.initial;

  /** Simulates, in the background, what the first click is most likely to need. */
  warm(): void {
    void this.lookAhead(this.generation).catch(ignoreCancelled);
  }

  setScenario(scenario: Scenario): void {
    const before = this.view;
    const sameAssumptions = tweaksKey(before.scenario.tweaks) === tweaksKey(scenario.tweaks);
    if (
      sameAssumptions &&
      setupKey(before.scenario.setup) === setupKey(scenario.setup) &&
      !before.error
    ) {
      return;
    }
    this.generation++;
    // Work queued for the previous scenario is no longer wanted. What is cached stays.
    this.pool?.clear();
    // The plan is greedy, so after taking its first steps the rest of it is the plan from there.
    const reached =
      sameAssumptions && before.planDone
        ? before.plan.findIndex((step) => setupKey(step.setup) === setupKey(scenario.setup))
        : -1;
    const followed = reached >= 0;
    this.publish({
      ...pendingView(scenario),
      // Today's company does not change when only the setup does.
      today: sameAssumptions ? before.today : null,
      todayReadings: sameAssumptions ? before.todayReadings : null,
      plan: followed ? before.plan.slice(reached + 1) : [],
      planDone: followed,
    });
    void this.compute(this.generation);
  }

  /** Tries again after a failed computation. */
  retry(): void {
    if (!this.view.error) return;
    this.generation++;
    this.publish({ ...this.view, error: null });
    void this.compute(this.generation);
  }

  /**
   * How much the gain of `target` over today depends on each assumption: the same comparison,
   * repeated with one assumption at a time moved to a lower and a higher value. `onProgress`
   * receives the share of the work that is done.
   */
  async sensitivity(
    target: Setup,
    tweaks: Tweaks,
    onProgress?: (share: number) => void,
  ): Promise<Swing[]> {
    const list = variations(tweaks);
    const total = list.length + 1;
    let done = 0;
    const gain = async (variant: Tweaks) => {
      const [before, after] = await Promise.all([
        this.runs(TODAY, variant),
        this.runs(target, variant),
      ]);
      done++;
      onProgress?.(done / total);
      return difference(before, after, "cash").mean;
    };
    const [base, ...results] = await Promise.all([
      gain(tweaks),
      ...list.map((variation) => gain(variation.tweaks)),
    ]);
    return swings(
      tweaks,
      base,
      list.map((variation, index) => ({ variation, result: results[index] ?? 0 })),
    );
  }

  /** Runs the engine against the queueing formulas, in a worker. */
  checks(): Promise<Check[]> {
    return this.ensurePool().checks(CHECK_CUSTOMERS);
  }

  dispose(): void {
    this.generation++;
    this.pool?.dispose();
    this.pool = null;
  }

  private ensurePool(): Pool {
    if (!this.pool) this.pool = new Pool();
    return this.pool;
  }

  private publish(view: View): void {
    this.view = view;
    for (const listener of this.listeners) listener();
  }

  private key(setup: Setup, tweaks: Tweaks, count: number): string {
    return `${count}|${tweaksKey(tweaks)}|${setupKey(setup)}`;
  }

  /**
   * The simulated quarters for a setup, from memory or from the pool. A request that was dropped
   * before it started (a newer change cleared the queue) is asked for again; without that, the
   * newer change would be handed a promise that can only fail, and would wait for ever.
   */
  private runs(setup: Setup, tweaks: Tweaks): Promise<Summary[]> {
    const count = this.count;
    const key = this.key(setup, tweaks, count);
    const known = this.quarters.get(key);
    if (known && !known.ticket.dropped) return known.promise;
    const ticket: Ticket = { dropped: false };
    const promise = this.ensurePool()
      .runs(setup, tweaks, count, ticket)
      .then((summaries) => {
        this.settled.set(key, summaries);
        return summaries;
      });
    const entry = { promise, ticket };
    this.quarters.set(key, entry);
    // A dropped or failed job must not be remembered as the answer.
    promise.catch(() => {
      if (this.quarters.get(key) === entry) this.quarters.delete(key);
    });
    return promise;
  }

  /** Every move from a setup, measured. Resolves once all the quarters it needs are in memory. */
  private async options(setup: Setup, tweaks: Tweaks): Promise<Option[]> {
    const moves = movesFrom(setup);
    await Promise.all([
      this.runs(setup, tweaks),
      ...moves.map((move) => this.runs(applyMove(setup, move), tweaks)),
    ]);
    const evaluate: Evaluate = (asked) => {
      const runs = this.settled.get(this.key(asked, tweaks, this.count));
      if (!runs) throw new Error(`Quarters for ${setupKey(asked)} are not in memory`);
      return runs;
    };
    return optionsFrom(setup, evaluate, assumptionsFor(tweaks));
  }

  private async compute(generation: number): Promise<void> {
    const { setup, tweaks } = this.view.scenario;
    const a = assumptionsFor(tweaks);
    const current = () => generation === this.generation;
    try {
      const [today, runs] = await Promise.all([this.runs(TODAY, tweaks), this.runs(setup, tweaks)]);
      if (!current()) return;
      const baseline = outcomeOf(TODAY, today, today, a);
      this.publish({
        ...this.view,
        today: baseline.now,
        todayReadings: baseline.readings,
        outcome: outcomeOf(setup, today, runs, a),
      });

      const options = await this.options(setup, tweaks);
      if (!current()) return;
      this.publish({ ...this.view, options });

      if (!this.view.planDone) {
        // The plan: take the best move, then look again from there, until nothing is worth its cost.
        const plan: Option[] = [];
        let open = options;
        for (;;) {
          const best = bestOf(open);
          if (!best) break;
          plan.push(best);
          this.publish({ ...this.view, plan: [...plan] });
          open = await this.options(best.setup, tweaks);
          if (!current()) return;
        }
        this.publish({ ...this.view, plan: [...plan], planDone: true });
      }
      void this.lookAhead(generation).catch(ignoreCancelled);
    } catch (error) {
      if (error instanceof Cancelled || !current()) return;
      console.error(error);
      this.publish({
        ...this.view,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Simulates what the recommended next move leads to, so that taking it is instant. */
  private async lookAhead(generation: number): Promise<void> {
    const { tweaks } = this.view.scenario;
    const next = this.view.plan[0];
    await this.runs(TODAY, tweaks);
    if (!next || generation !== this.generation) return;
    await this.options(next.setup, tweaks);
  }
}

function ignoreCancelled(error: unknown): void {
  if (error instanceof Cancelled) return;
  console.error(error);
}
