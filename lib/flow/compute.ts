/**
 * The work a simulation job does, wherever it runs: in a worker, on the page as a fallback, or
 * on the server when the first screen is built.
 */
import type { Assumptions } from "@/core/flow/company";
import { runQuarter, type Summary, summarize } from "@/core/flow/experiment";
import { type Demand, demandFor, demandKey } from "@/core/flow/requests";
import { assumptionsFor } from "@/core/flow/scenario";
import { runChecks } from "@/core/flow/validate";
import type { Job, Reply } from "./protocol";

/** Sets of customer streams kept in memory: the visitor's assumptions and one variation of them. */
const STREAM_SETS = 2;

/** Customer streams by the assumptions that shape them, most recently used last. */
const streams = new Map<string, Map<number, Demand>>();

function demandOf(seed: number, a: Assumptions): Demand {
  const key = demandKey(a);
  const bySeed = streams.get(key) ?? new Map<number, Demand>();
  // Re-inserting moves the set to the end, so the first key is always the least recently used.
  streams.delete(key);
  streams.set(key, bySeed);
  for (const oldest of streams.keys()) {
    if (streams.size <= STREAM_SETS) break;
    streams.delete(oldest);
  }
  let demand = bySeed.get(seed);
  if (!demand) {
    demand = demandFor(seed, a);
    bySeed.set(seed, demand);
  }
  return demand;
}

/** One simulated quarter for one seed. */
export function runSeed(job: Extract<Job, { kind: "runs" }>, seed: number): Summary {
  const a = assumptionsFor(job.tweaks);
  return summarize(runQuarter(job.setup, seed, a, demandOf(seed, a)), job.setup, a);
}

export function perform(job: Job): Reply {
  try {
    if (job.kind === "checks") {
      return { id: job.id, ok: true, kind: "checks", checks: runChecks(job.customers) };
    }
    const summaries = job.seeds.map((seed) => runSeed(job, seed));
    return { id: job.id, ok: true, kind: "runs", summaries };
  } catch (error) {
    return { id: job.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
