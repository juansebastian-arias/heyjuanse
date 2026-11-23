/**
 * Choosing what to change next.
 *
 * A move is one change: switch on an improvement, or add a person to a team. Every move open
 * from the current setup is tried on the same simulated customers, and ranked by what it leaves
 * after its own cost: the margin on the extra sales, minus what the change costs to run.
 *
 * The plan is greedy: take the best move, then look again from there. In a line of teams the
 * best move is nearly always "relieve whatever limits the flow right now", and what limits the
 * flow changes after every move, so the plan is recomputed at each step and never read off a
 * fixed list. `planner.test.ts` checks the result against every combination of improvements.
 */
import {
  type Assumptions,
  BASE,
  costOf,
  extraPeople,
  hasLever,
  LEVER_IDS,
  LEVERS,
  type LeverId,
  MAX_EXTRA_PEOPLE,
  type Setup,
  STATION_IDS,
  type StationId,
  withExtra,
  withLever,
} from "./company";
import { type Difference, difference, isClear, type Summary } from "./experiment";

export type Move = { kind: "lever"; lever: LeverId } | { kind: "hire"; station: StationId };

export function moveKey(move: Move): string {
  return move.kind === "lever" ? `lever:${move.lever}` : `hire:${move.station}`;
}

export function moveStation(move: Move): StationId {
  return move.kind === "lever" ? LEVERS[move.lever].station : move.station;
}

export function applyMove(setup: Setup, move: Move): Setup {
  return move.kind === "lever"
    ? withLever(setup, move.lever, true)
    : withExtra(setup, move.station, extraPeople(setup, move.station) + 1);
}

/** Every change that can still be made from a setup. */
export function movesFrom(setup: Setup): Move[] {
  const levers = LEVER_IDS.filter((lever) => !hasLever(setup, lever)).map(
    (lever): Move => ({ kind: "lever", lever }),
  );
  const hires = STATION_IDS.filter((station) => extraPeople(setup, station) < MAX_EXTRA_PEOPLE).map(
    (station): Move => ({ kind: "hire", station }),
  );
  return [...levers, ...hires];
}

/** The simulated quarters for a setup, always on the same customers. */
export type Evaluate = (setup: Setup) => readonly Summary[];

export type Verdict =
  /** The gain after costs is clearly above zero. */
  | "worth"
  /** The gain cannot be told apart from run-to-run luck. */
  | "unclear"
  /** It clearly costs more than it brings in. */
  | "costs more";

export interface Option {
  move: Move;
  /** The setup after the move. */
  setup: Setup;
  /** Changes per month against the setup before the move, on the same customers. */
  cash: Difference;
  paid: Difference;
  lostBuyers: Difference;
  /** Margin on the extra sales minus the running cost of the move. */
  net: Difference;
  /** Median days from request to payment, after minus before. */
  cashDays: Difference;
  /** What the move costs: per month, and once to build. */
  monthly: number;
  build: number;
  /** Months for the gain after costs to repay the build cost. Null when it never does. */
  paybackMonths: number | null;
  verdict: Verdict;
}

export function verdictOf(net: Difference): Verdict {
  if (!isClear(net)) return "unclear";
  return net.mean > 0 ? "worth" : "costs more";
}

/** One move, measured against the setup it starts from. */
export function evaluateMove(
  setup: Setup,
  move: Move,
  evaluate: Evaluate,
  a: Assumptions = BASE,
): Option {
  const next = applyMove(setup, move);
  const before = evaluate(setup);
  const after = evaluate(next);
  const net = difference(before, after, "net");
  const costBefore = costOf(setup, a);
  const costAfter = costOf(next, a);
  const build = costAfter.setup - costBefore.setup;
  const verdict = verdictOf(net);
  return {
    move,
    setup: next,
    cash: difference(before, after, "cash"),
    paid: difference(before, after, "paid"),
    lostBuyers: difference(before, after, "lostBuyers"),
    net,
    cashDays: difference(before, after, "cashDays"),
    monthly: costAfter.monthly - costBefore.monthly,
    build,
    paybackMonths: verdict === "worth" ? build / net.mean : null,
    verdict,
  };
}

/** Every open move from a setup, best first. */
export function optionsFrom(setup: Setup, evaluate: Evaluate, a: Assumptions = BASE): Option[] {
  return rank(movesFrom(setup).map((move) => evaluateMove(setup, move, evaluate, a)));
}

export function rank(options: readonly Option[]): Option[] {
  return [...options].sort(
    (x, y) => y.net.mean - x.net.mean || moveKey(x.move).localeCompare(moveKey(y.move)),
  );
}

/** The best move that is clearly worth making, if there is one. */
export function bestOf(options: readonly Option[]): Option | null {
  return rank(options).find((option) => option.verdict === "worth") ?? null;
}

/** The moves to make, in order, until nothing left is clearly worth its cost. */
export function planFrom(
  setup: Setup,
  evaluate: Evaluate,
  a: Assumptions = BASE,
  maxSteps = LEVER_IDS.length + STATION_IDS.length * MAX_EXTRA_PEOPLE,
): Option[] {
  const steps: Option[] = [];
  let current = setup;
  while (steps.length < maxSteps) {
    const best = bestOf(optionsFrom(current, evaluate, a));
    if (!best) break;
    steps.push(best);
    current = best.setup;
  }
  return steps;
}
