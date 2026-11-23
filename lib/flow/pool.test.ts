import { describe, expect, it } from "vitest";
import { TODAY, withLever } from "@/core/flow/company";
import { demands, runMany } from "@/core/flow/experiment";
import { assumptionsFor } from "@/core/flow/scenario";
import { Cancelled, Pool } from "./pool";

// Vitest runs these in Node, where there is no Worker: every lane does its work in place, which
// is the path a browser without workers takes.
const ROUTING = withLever(TODAY, "routing", true);

describe("the worker pool", () => {
  it("returns exactly what the model computes, in seed order, however many lanes it has", async () => {
    const direct = runMany(TODAY, demands(7));
    for (const lanes of [1, 2, 3, 4]) {
      const pool = new Pool(lanes);
      expect(pool.lanes).toBe(lanes);
      expect(await pool.runs(TODAY, {}, 7)).toEqual(direct);
      pool.dispose();
    }
  });

  it("works with fewer quarters than lanes", async () => {
    const pool = new Pool(4);
    expect(await pool.runs(TODAY, {}, 2)).toEqual(runMany(TODAY, demands(2)));
    pool.dispose();
  });

  it("applies the visitor's assumptions to the customers it simulates", async () => {
    const pool = new Pool(2);
    const tweaks = { demand: 18, accept: 50 };
    const a = assumptionsFor(tweaks);
    expect(await pool.runs(ROUTING, tweaks, 3)).toEqual(runMany(ROUTING, demands(3, a), a));
    pool.dispose();
  });

  it("keeps answers apart when several setups are asked for at once", async () => {
    const pool = new Pool(2);
    const [today, routing] = await Promise.all([
      pool.runs(TODAY, {}, 4),
      pool.runs(ROUTING, {}, 4),
    ]);
    expect(today).toEqual(runMany(TODAY, demands(4)));
    expect(routing).toEqual(runMany(ROUTING, demands(4)));
    expect(pool.outstanding).toBe(0);
    pool.dispose();
  });

  it("drops work that has not started when asked to, and says so to whoever was waiting", async () => {
    const pool = new Pool(1);
    const first = pool.runs(TODAY, {}, 2);
    const second = pool.runs(ROUTING, {}, 2);
    pool.clear();
    await expect(second).rejects.toBeInstanceOf(Cancelled);
    // The job that had already started still finishes.
    expect(await first).toEqual(runMany(TODAY, demands(2)));
    pool.dispose();
  });

  it("refuses new work once it is shut down", async () => {
    const pool = new Pool(2);
    pool.dispose();
    await expect(pool.runs(TODAY, {}, 2)).rejects.toBeInstanceOf(Cancelled);
    await expect(pool.checks(1000)).rejects.toBeInstanceOf(Cancelled);
  });

  it("runs the checks against the queueing formulas", async () => {
    const pool = new Pool(2);
    const checks = await pool.checks(20_000);
    expect(checks.length).toBeGreaterThanOrEqual(7);
    for (const check of checks) {
      expect(Number.isFinite(check.simulated)).toBe(true);
      expect(check.expected).toBeGreaterThan(0);
    }
    pool.dispose();
  });
});
