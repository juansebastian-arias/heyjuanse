import { STATIONS } from "@/core/flow/company";
import type { Projection } from "@/core/flow/experiment";
import { moveStation, type Option } from "@/core/flow/planner";
import { signedMoney } from "@/lib/flow/format";
import { type Outcome, RUNS, type View } from "@/lib/flow/view";
import { costText, moveName, setupText, soFar } from "@/lib/flow/words";
import styles from "./NextMove.module.css";

interface NextMoveProps {
  view: View;
  today: Projection | null;
  changed: boolean;
  onApply(option: Option): void;
  onReset(): void;
  onRetry(): void;
}

/** What the changes made so far add up to, in one sentence. */
function Result({
  changes,
  today,
  outcome,
}: {
  changes: string;
  today: Projection;
  outcome: Outcome;
}) {
  const { cash, lost } = soFar(
    { cash: today.totals.cash.mean, lostBuyers: today.totals.lostBuyers.mean },
    { cash: outcome.now.totals.cash.mean, lostBuyers: outcome.now.totals.lostBuyers.mean },
    outcome.delta,
  );
  const collects = cash ? (
    <>
      collects about <strong>{cash.now} a month</strong> instead of {cash.was}
    </>
  ) : null;
  const loses = lost ? (
    <>
      loses{" "}
      <strong>
        {lost.now} {lost.noun} a month
      </strong>{" "}
      to waiting instead of {lost.was}
    </>
  ) : null;
  if (collects && loses) {
    return (
      <>
        With {changes}, Larkspur {collects} and {loses}.
      </>
    );
  }
  if (collects) {
    return (
      <>
        With {changes}, Larkspur {collects}.
      </>
    );
  }
  if (loses) {
    return (
      <>
        With {changes}, Larkspur {loses}. Sales collected show no clear change.
      </>
    );
  }
  return (
    <>
      With {changes}, a month looks the same as today: no clear change in sales collected or in
      buyers lost to waiting.
    </>
  );
}

/**
 * The page's console: what the changes so far came to, and the one thing to do next, which is
 * the planner's best move from here with a button that makes it.
 */
export function NextMove({ view, today, changed, onApply, onReset, onRetry }: NextMoveProps) {
  const next = view.plan[0];

  if (view.error) {
    return (
      <div className={styles.next} data-state="error" role="alert">
        <div className={styles.row}>
          <div className={styles.text}>
            <p className={styles.name}>The simulation could not run in this browser.</p>
            <p className={styles.gain}>
              The figures on this page are computed here, on your device, and that failed:{" "}
              {view.error}
            </p>
          </div>
          <button type="button" className="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const state = next ? "move" : view.planDone ? "done" : "working";
  const station = next ? STATIONS[moveStation(next.move)] : null;

  return (
    <section className={styles.next} data-state={state} aria-label="The next move">
      <div className={styles.sofar} data-on={changed || undefined}>
        <div className={styles.clip}>
          <div className={styles.line}>
            {/* Always in the page, so that a screen reader hears the result when it arrives. */}
            <p className={styles.result} role="status">
              {changed ? (
                <>
                  <span className="tag">So far</span>{" "}
                  {view.outcome && today ? (
                    <Result
                      changes={setupText(view.scenario.setup)}
                      today={today}
                      outcome={view.outcome}
                    />
                  ) : (
                    `Simulating ${RUNS} quarters of Larkspur with ${setupText(view.scenario.setup)}…`
                  )}
                </>
              ) : null}
            </p>
            {changed ? (
              <button type="button" className={styles.reset} onClick={onReset}>
                Start over
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.text} aria-live="polite" aria-atomic="true">
          {next && station ? (
            <>
              <p className={styles.where}>
                <span className="tag" data-kind="key">
                  Best next move
                </span>{" "}
                at {station.name}
              </p>
              <p className={styles.name}>{moveName(next.move)}</p>
              <p className={styles.gain}>
                About <strong>{signedMoney(next.cash.mean)} a month</strong> in sales collected, for{" "}
                {costText(next.monthly, next.build)}.
              </p>
            </>
          ) : state === "working" ? (
            <>
              <p className={styles.name}>Measuring every change that is still open…</p>
              <p className={styles.gain}>
                Each one is tried on {RUNS} simulated quarters, here in your browser.
              </p>
            </>
          ) : (
            <>
              <p className={styles.name}>
                {changed
                  ? "Nothing else is clearly worth its cost."
                  : "No change is clearly worth its cost."}
              </p>
              <p className={styles.gain}>
                {changed
                  ? "Every change left costs more than it brings in, or too little to tell from luck."
                  : "Under these assumptions, every change costs more than it brings in, or too little to tell from luck."}
              </p>
            </>
          )}
        </div>
        {next ? (
          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => onApply(next)}
          >
            Make this change
          </button>
        ) : state === "working" ? (
          <span className={styles.pulse} aria-hidden="true" />
        ) : null}
      </div>
    </section>
  );
}
