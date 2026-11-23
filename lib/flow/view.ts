/**
 * What the page shows for a scenario, built from simulated quarters. The same functions build
 * the first screen on the server and every later screen in the browser, so a number can never be
 * computed one way in one place and another way somewhere else.
 */
import {
  type Assumptions,
  BASE,
  costOf,
  type Setup,
  type SetupCost,
  setupKey,
  TODAY,
} from "@/core/flow/company";
import { type Reading, readAll } from "@/core/flow/diagnose";
import {
  type Difference,
  demands,
  difference,
  type Projection,
  project,
  runMany,
  type Summary,
} from "@/core/flow/experiment";
import { type Evaluate, type Option, optionsFrom, planFrom } from "@/core/flow/planner";
import { type Scenario, START } from "@/core/flow/scenario";

/** Simulated quarters behind every figure on the page. */
export const RUNS = 60;

export const DELTA_KEYS = [
  "cash",
  "paid",
  "lostBuyers",
  "lostValue",
  "replyWaitHours",
  "cashDays",
  "net",
] as const;
export type DeltaKey = (typeof DELTA_KEYS)[number];

/** A setup, measured on its own and against how the company runs today. */
export interface Outcome {
  now: Projection;
  readings: Reading[];
  /** The setup minus today, on the same customers. */
  delta: Record<DeltaKey, Difference>;
  cost: SetupCost;
}

export interface View {
  scenario: Scenario;
  /** How the company runs today, under the scenario's assumptions. Null while it is being simulated. */
  today: Projection | null;
  todayReadings: Reading[] | null;
  /** The scenario's setup. Null while it is being simulated. */
  outcome: Outcome | null;
  /** Every change still open from the setup, best first. Null while they are being measured. */
  options: Option[] | null;
  /** The planner's next steps from the setup, as far as they have been worked out. */
  plan: Option[];
  planDone: boolean;
  /** Set when the simulation could not be run, with what went wrong. */
  error: string | null;
}

export function outcomeOf(
  setup: Setup,
  today: readonly Summary[],
  runs: readonly Summary[],
  a: Assumptions = BASE,
): Outcome {
  const now = project(runs);
  const delta = {} as Outcome["delta"];
  for (const key of DELTA_KEYS) delta[key] = difference(today, runs, key);
  return { now, readings: readAll(now), delta, cost: costOf(setup, a) };
}

/** An empty view for a scenario whose numbers are still on their way. */
export function pendingView(scenario: Scenario): View {
  return {
    scenario,
    today: null,
    todayReadings: null,
    outcome: null,
    options: null,
    plan: [],
    planDone: false,
    error: null,
  };
}

let first: View | null = null;

/**
 * The first screen: the company as it runs today, every first move measured, and the whole plan
 * from there. Computed once where the page is built, so the page arrives with its numbers.
 */
export function startView(): View {
  first ??= computeStartView();
  return first;
}

function computeStartView(): View {
  const streams = demands(RUNS);
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
  const today = evaluate(TODAY);
  const outcome = outcomeOf(TODAY, today, today);
  return {
    scenario: START,
    today: outcome.now,
    todayReadings: outcome.readings,
    outcome,
    options: optionsFrom(TODAY, evaluate),
    plan: planFrom(TODAY, evaluate),
    planDone: true,
    error: null,
  };
}
