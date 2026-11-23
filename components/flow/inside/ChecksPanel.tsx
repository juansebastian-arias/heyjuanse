"use client";

import { useState } from "react";
import type { Check } from "@/core/flow/validate";
import type { FlowStore } from "@/lib/flow/store";
import styles from "../Inside.module.css";
import { ChecksTable } from "./ChecksTable";

/** What the automated tests said when this version of the site was built. */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  files: number;
  ranAt: string;
}

interface ChecksPanelProps {
  store: FlowStore;
  tests: TestSummary | null;
  repository: string;
}

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; checks: Check[]; seconds: number }
  | { kind: "error"; message: string };

const CUSTOMERS = "100,000";

/** Runs the engine against queues with known answers, in the visitor's browser. */
export function ChecksPanel({ store, tests, repository }: ChecksPanelProps) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "running" });
    const started = performance.now();
    try {
      const checks = await store.checks();
      setState({ kind: "done", checks, seconds: (performance.now() - started) / 1000 });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  const passed = state.kind === "done" ? state.checks.filter((check) => check.pass).length : 0;

  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        A simulation can look right and be wrong. So the engine that runs Larkspur is also run on
        four simple queues that mathematics solved long ago, and its answers are compared with the
        formulas. This runs on your device, now: {CUSTOMERS} customers per queue.
      </p>
      <p>
        <button type="button" className="button" onClick={run} disabled={state.kind === "running"}>
          {state.kind === "done" ? "Run the checks again" : "Run the checks"}
        </button>
      </p>
      <div aria-live="polite" className={styles.stack}>
        {state.kind === "running" ? (
          <p className={styles.note}>Simulating four queues, {CUSTOMERS} customers each…</p>
        ) : null}
        {state.kind === "error" ? (
          <p className={styles.error}>The checks could not run: {state.message}</p>
        ) : null}
        {state.kind === "done" ? (
          <>
            <p className={styles.result} data-ok={passed === state.checks.length || undefined}>
              {passed} of {state.checks.length} checks agree with the formulas. Simulated in{" "}
              {state.seconds.toFixed(1)} seconds.
            </p>
            <ChecksTable checks={state.checks} />
          </>
        ) : null}
      </div>

      <section className={styles.block}>
        <h3 className={styles.heading}>Tests that ran before this version went live</h3>
        {tests ? (
          <p className={styles.note}>
            {tests.passed.toLocaleString("en-US")} of {tests.total.toLocaleString("en-US")}{" "}
            automated tests passed across {tests.files} files
            {tests.failed > 0 ? `, ${tests.failed} failed` : ""}, on{" "}
            {new Date(tests.ranAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
            . They cover the engine event by event, hand-computed scenarios, the planner against
            every combination of changes, and these same queues.
          </p>
        ) : (
          <p className={styles.note}>
            The test report is written when the site is built for release. This copy was not built
            that way, so there is no report to show.
          </p>
        )}
        <p className={styles.note}>
          <a href="/engine">How the model is built</a> ·{" "}
          <a href={`${repository}/tree/main/core/flow`}>Read the engine's code</a>
        </p>
      </section>
    </div>
  );
}
