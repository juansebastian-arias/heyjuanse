/**
 * A small pool of workers that run simulations for the page. Each quarter is simulated once per
 * seed, and a seed always goes to the same worker, so every worker builds its own share of the
 * customer streams once and reuses them for every setup it is asked about.
 *
 * If workers cannot start (an old browser, a blocked script), the same jobs run on the page
 * itself, one quarter at a time, giving the browser a chance to breathe in between.
 */
import type { Setup } from "@/core/flow/company";
import type { Summary } from "@/core/flow/experiment";
import type { Tweaks } from "@/core/flow/scenario";
import type { Check } from "@/core/flow/validate";
import { perform, runSeed } from "./compute";
import type { Job, Reply } from "./protocol";

/** Thrown into a job's promise when the job was dropped before it started. */
export class Cancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "Cancelled";
  }
}

/**
 * Handed in with a request for quarters. If any part of the request is dropped before it starts,
 * `dropped` is set at that very moment, before the request's promise has had a chance to reject,
 * so whoever keeps the promise can tell at once that it will never deliver.
 */
export interface Ticket {
  dropped: boolean;
}

type Unsent =
  | { kind: "runs"; setup: Setup; tweaks: Tweaks; seeds: number[] }
  | { kind: "checks"; customers: number };

interface Pending {
  job: Job;
  ticket: Ticket | null;
  resolve(reply: Reply): void;
  reject(error: Error): void;
}

interface Lane {
  worker: Worker | null;
  busy: Pending | null;
  queue: Pending[];
}

const MAX_LANES = 4;

export class Pool {
  private readonly laneList: Lane[] = [];
  private nextId = 1;
  private disposed = false;

  constructor(lanes = defaultLanes()) {
    for (let index = 0; index < lanes; index++) {
      this.laneList.push({ worker: this.startWorker(index), busy: null, queue: [] });
    }
  }

  get lanes(): number {
    return this.laneList.length;
  }

  /** Jobs waiting or running. */
  get outstanding(): number {
    return this.laneList.reduce((sum, lane) => sum + lane.queue.length + (lane.busy ? 1 : 0), 0);
  }

  /** Simulated quarters for seeds 1 to `count`, in seed order. */
  async runs(
    setup: Setup,
    tweaks: Tweaks,
    count: number,
    ticket: Ticket | null = null,
  ): Promise<Summary[]> {
    const lanes = this.laneList.length;
    const parts = await Promise.all(
      this.laneList.map((_, index) => {
        const seeds: number[] = [];
        for (let seed = 1 + index; seed <= count; seed += lanes) seeds.push(seed);
        if (seeds.length === 0) return Promise.resolve<Summary[]>([]);
        return this.send(index, { kind: "runs", setup, tweaks, seeds }, ticket).then((reply) =>
          reply.ok && reply.kind === "runs" ? reply.summaries : fail(reply),
        );
      }),
    );
    const summaries: Summary[] = [];
    for (let seed = 1; seed <= count; seed++) {
      const summary = parts[(seed - 1) % lanes]?.[Math.floor((seed - 1) / lanes)];
      if (!summary) throw new Error(`No result for seed ${seed}`);
      summaries.push(summary);
    }
    return summaries;
  }

  async checks(customers: number): Promise<Check[]> {
    // The last lane is the least likely to be busy with the first seeds of a new setup.
    const reply = await this.send(this.laneList.length - 1, { kind: "checks", customers });
    return reply.ok && reply.kind === "checks" ? reply.checks : fail(reply);
  }

  /** Drops every job that has not started. Jobs already running finish and are ignored by their callers. */
  clear(): void {
    for (const lane of this.laneList) {
      for (const pending of lane.queue.splice(0)) {
        if (pending.ticket) pending.ticket.dropped = true;
        pending.reject(new Cancelled());
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
    for (const lane of this.laneList) {
      lane.worker?.terminate();
      lane.worker = null;
    }
  }

  private startWorker(index: number): Worker | null {
    if (typeof Worker === "undefined") return null;
    try {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<Reply>) => this.finish(index, event.data);
      worker.onerror = () => this.fallBack(index);
      return worker;
    } catch {
      return null;
    }
  }

  private send(index: number, unsent: Unsent, ticket: Ticket | null = null): Promise<Reply> {
    const lane = this.laneList[index];
    if (!lane || this.disposed) {
      if (ticket) ticket.dropped = true;
      return Promise.reject(new Cancelled());
    }
    return new Promise<Reply>((resolve, reject) => {
      lane.queue.push({ job: { ...unsent, id: this.nextId++ }, ticket, resolve, reject });
      this.pump(index);
    });
  }

  private pump(index: number): void {
    const lane = this.laneList[index];
    if (!lane || lane.busy) return;
    const next = lane.queue.shift();
    if (!next) return;
    lane.busy = next;
    if (lane.worker) lane.worker.postMessage(next.job);
    else void this.runHere(index, next.job);
  }

  private finish(index: number, reply: Reply): void {
    const lane = this.laneList[index];
    if (!lane?.busy || lane.busy.job.id !== reply.id) return;
    const done = lane.busy;
    lane.busy = null;
    done.resolve(reply);
    this.pump(index);
  }

  /** The worker failed: this lane does its work on the page from now on, starting with the job it had. */
  private fallBack(index: number): void {
    const lane = this.laneList[index];
    if (!lane) return;
    lane.worker?.terminate();
    lane.worker = null;
    if (lane.busy) void this.runHere(index, lane.busy.job);
    else this.pump(index);
  }

  private async runHere(index: number, job: Job): Promise<void> {
    if (job.kind !== "runs") {
      await pause();
      this.finish(index, perform(job));
      return;
    }
    const summaries: Summary[] = [];
    try {
      for (const seed of job.seeds) {
        await pause();
        if (this.disposed) return;
        summaries.push(runSeed(job, seed));
      }
      this.finish(index, { id: job.id, ok: true, kind: "runs", summaries });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.finish(index, { id: job.id, ok: false, error: message });
    }
  }
}

function defaultLanes(): number {
  const cores = typeof navigator === "undefined" ? 2 : navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(MAX_LANES, cores - 1));
}

function fail(reply: Reply): never {
  throw new Error(reply.ok ? "Unexpected reply" : reply.error);
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
