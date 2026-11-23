/**
 * Checking the engine against queues whose answers are known. Each case builds a one-team
 * process the textbooks can solve, runs a long stream of customers through the same engine that
 * simulates Larkspur, and compares what was measured with the formula.
 *
 * A check passes when the formula's value lies inside the measurement's 99% confidence interval,
 * or within 2% of it. The interval comes from splitting the run into batches and looking at how
 * much their averages disagree.
 */
import { createRng } from "../random";
import { ALWAYS } from "./calendar";
import type { Dist } from "./dist";
import { FlowSim, type ProcessSpec, type Request } from "./engine";
import { erlangA, erlangC, mg1Wait, mmcWait } from "./theory";

export interface QueueCase {
  id: string;
  /** The queue in standard notation, and in words. */
  notation: string;
  about: string;
  /** Mean minutes between arrivals. */
  between: number;
  service: Dist;
  servers: number;
  /** Mean minutes a customer waits before leaving. Null: forever. */
  patience: number | null;
}

export type Measure = "wait" | "waits" | "abandon";

export interface Check {
  case: QueueCase;
  measure: Measure;
  /** What is compared, in words, and its unit. */
  what: string;
  unit: "min" | "%";
  formula: string;
  expected: number;
  simulated: number;
  /** Half the width of the 99% confidence interval of the simulated value. */
  margin: number;
  pass: boolean;
}

export const CASES: readonly QueueCase[] = [
  {
    id: "mm1",
    notation: "M/M/1",
    about: "One person, random arrivals, service times that vary a lot. Busy 80% of the time.",
    between: 12.5,
    service: { kind: "exp", mean: 10 },
    servers: 1,
    patience: null,
  },
  {
    id: "mmc",
    notation: "M/M/3",
    about: "Three people sharing one line, busy 80% of the time.",
    between: 12.5,
    service: { kind: "exp", mean: 30 },
    servers: 3,
    patience: null,
  },
  {
    id: "mg1",
    notation: "M/G/1",
    about:
      "One person, with the lognormal service times Larkspur's teams use. Busy 85% of the time.",
    between: 20,
    service: { kind: "lognormal", mean: 17, cv: 0.5 },
    servers: 1,
    patience: null,
  },
  {
    id: "erlang-a",
    notation: "M/M/2+M",
    about:
      "Two people with more work than they can do, and customers who give up after an hour on average.",
    between: 10,
    service: { kind: "exp", mean: 25 },
    servers: 2,
    patience: 60,
  },
];

const BATCHES = 20;
/** Student's t for 19 degrees of freedom at 99.5%, for a two-sided 99% interval. */
const T_99 = 2.861;
const WARMUP_SHARE = 0.05;

interface Sample {
  /** Minutes in line, for every customer, served or not. */
  wait: number;
  waited: boolean;
  left: boolean;
}

/** Runs one case and returns what happened to each customer after the warm-up, in arrival order. */
export function simulateCase(queue: QueueCase, customers: number, seed: number): Sample[] {
  const rng = createRng(seed);
  const byDay = new Map<number, Request[]>();
  let clock = 0;
  for (let i = 0; i < customers; i++) {
    clock += -queue.between * Math.log(1 - rng.next());
    const day = Math.floor(clock / ALWAYS.day);
    const request: Request = {
      id: i,
      at: clock,
      value: 1,
      exitAfter: 1,
      key: Math.floor(rng.next() * 4294967296),
      label: "",
      size: 1,
    };
    const list = byDay.get(day);
    if (list) list.push(request);
    else byDay.set(day, [request]);
  }
  const process: ProcessSpec = {
    stations: [
      {
        id: "desk",
        servers: queue.servers,
        touch: queue.service,
        stretch: 1,
        releaseAt: [],
        patience: queue.patience === null ? null : { kind: "exp", mean: queue.patience },
        bypass: 0,
        rework: 0,
        reworkDelay: 0,
      },
    ],
    payment: null,
  };
  const samples: Sample[] = new Array(customers);
  const sim = new FlowSim(process, (day) => byDay.get(day) ?? [], ALWAYS);
  sim.on((kind, item, _station, flow) => {
    if (kind !== "start" && kind !== "left") return;
    const wait = flow.wall - item.entered;
    samples[item.req.id] = { wait, waited: wait > 1e-9, left: kind === "left" };
  });
  sim.advanceTo(clock + 1e6);
  const first = Math.floor(customers * WARMUP_SHARE);
  return samples.slice(first).filter((sample) => sample !== undefined);
}

function batchEstimate(values: readonly number[]): { mean: number; margin: number } {
  const size = Math.floor(values.length / BATCHES);
  const means: number[] = [];
  for (let b = 0; b < BATCHES; b++) {
    let total = 0;
    for (let i = b * size; i < (b + 1) * size; i++) total += values[i] ?? 0;
    means.push(total / size);
  }
  const mean = means.reduce((sum, value) => sum + value, 0) / BATCHES;
  const variance = means.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (BATCHES - 1);
  return { mean, margin: T_99 * Math.sqrt(variance / BATCHES) };
}

function check(
  queue: QueueCase,
  measure: Measure,
  what: string,
  unit: Check["unit"],
  formula: string,
  expected: number,
  values: readonly number[],
): Check {
  const scale = unit === "%" ? 100 : 1;
  const { mean, margin } = batchEstimate(values);
  const off = Math.abs(mean - expected);
  return {
    case: queue,
    measure,
    what,
    unit,
    formula,
    expected: expected * scale,
    simulated: mean * scale,
    margin: margin * scale,
    pass: off <= margin || off <= 0.02 * Math.abs(expected),
  };
}

/** Runs every case. With the default size this takes about a second. */
export function runChecks(customers = 200_000, seed = 11): Check[] {
  const checks: Check[] = [];
  for (const queue of CASES) {
    const samples = simulateCase(queue, customers, seed);
    const rate = 1 / queue.between;
    const mean = queue.service.kind === "const" ? queue.service.value : queue.service.mean;
    const waits = samples.map((sample) => sample.wait);
    if (queue.patience !== null) {
      const theory = erlangA(rate, mean, queue.servers, queue.patience);
      checks.push(
        check(
          queue,
          "abandon",
          "Customers who give up",
          "%",
          "Erlang-A",
          theory.abandonShare,
          samples.map((sample) => (sample.left ? 1 : 0)),
        ),
        check(queue, "wait", "Average time in line", "min", "Erlang-A", theory.meanWait, waits),
      );
      continue;
    }
    if (queue.service.kind === "exp") {
      checks.push(
        check(
          queue,
          "waits",
          "Customers who have to wait",
          "%",
          "Erlang C",
          erlangC(queue.servers, rate * mean),
          samples.map((sample) => (sample.waited ? 1 : 0)),
        ),
        check(
          queue,
          "wait",
          "Average time in line",
          "min",
          "Erlang C",
          mmcWait(rate, mean, queue.servers),
          waits,
        ),
      );
      continue;
    }
    const spread = queue.service.kind === "lognormal" ? queue.service.cv : 0;
    checks.push(
      check(
        queue,
        "wait",
        "Average time in line",
        "min",
        "Pollaczek-Khinchine",
        mg1Wait(rate, mean, spread),
        waits,
      ),
    );
  }
  return checks;
}
