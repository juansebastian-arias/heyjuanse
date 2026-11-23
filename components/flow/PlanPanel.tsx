"use client";

import { useState } from "react";
import {
  costOf,
  extraPeople,
  hasLever,
  LEVER_IDS,
  LEVERS,
  type Setup,
  STATION_IDS,
  STATIONS,
  withExtra,
  withLever,
} from "@/core/flow/company";
import { moveKey, moveStation, type Option } from "@/core/flow/planner";
import { assumptionsFor, isChanged } from "@/core/flow/scenario";
import { plural, signedMoney } from "@/lib/flow/format";
import type { View } from "@/lib/flow/view";
import { costText, moveName } from "@/lib/flow/words";
import styles from "./PlanPanel.module.css";

interface PlanPanelProps {
  view: View;
  onApply(option: Option, follow: boolean): void;
  onSetup(setup: Setup): void;
  onReset(): void;
}

type Copied = "idle" | "done" | "failed";

/** What the visitor has changed so far, and what the planner would do from here. */
export function PlanPanel({ view, onApply, onSetup, onReset }: PlanPanelProps) {
  const [copied, setCopied] = useState<Copied>("idle");
  const { setup, tweaks } = view.scenario;
  const a = assumptionsFor(tweaks);
  const changed = isChanged(setup);
  const cost = costOf(setup, a);
  const { plan } = view;
  const last = plan[plan.length - 1];
  const together = plan.reduce((sum, step) => sum + step.cash.mean, 0);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2400);
  }

  return (
    <aside className={styles.plan} aria-label="Your changes and the plan">
      <section>
        <h2 className={styles.heading}>Your changes</h2>
        {changed ? (
          <>
            <ul className={styles.changes}>
              {LEVER_IDS.filter((id) => hasLever(setup, id)).map((id) => (
                <li key={id}>
                  <span>{LEVERS[id].name}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => onSetup(withLever(setup, id, false))}
                    aria-label={`Undo: ${LEVERS[id].name}`}
                  >
                    Undo
                  </button>
                </li>
              ))}
              {STATION_IDS.filter((id) => extraPeople(setup, id) > 0).map((id) => {
                const extra = extraPeople(setup, id);
                const role = STATIONS[id].role;
                const title = `${extra} more ${plural(extra, role, `${role}s`)} hired`;
                return (
                  <li key={id}>
                    <span>{title}</span>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => onSetup(withExtra(setup, id, extra - 1))}
                      aria-label={`Undo one hire: ${role}`}
                    >
                      Undo
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className={styles.small}>Together they cost {costText(cost.monthly, cost.setup)}.</p>
          </>
        ) : (
          <p className={styles.small}>None yet. This is Larkspur as it runs today.</p>
        )}
      </section>

      <section>
        <h2 className={styles.heading}>What the model would do next</h2>
        {plan.length > 0 ? (
          <ol className={styles.steps}>
            {plan.map((step, index) => (
              <li key={moveKey(step.move)}>
                <span className={styles.number}>{index + 1}</span>
                <span className={styles.step}>
                  <span>{moveName(step.move)}</span>
                  <span className={styles.small}>
                    {STATIONS[moveStation(step.move)].name} ·{" "}
                    <span className="num">{signedMoney(step.cash.mean)}</span> a month
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        <p className={styles.small} aria-live="polite">
          {!view.planDone
            ? "Working out the next steps…"
            : plan.length > 0
              ? "Then it stops: nothing else is clearly worth its cost. After each step the model looks again, because fixing one team moves the wait to another."
              : "Nothing left is clearly worth its cost."}
        </p>
        {plan.length > 1 && last && view.planDone ? (
          <div className={styles.all}>
            <button type="button" className="button" onClick={() => onApply(last, true)}>
              Make all {plan.length} changes
            </button>
            <p className={styles.small}>
              Together about <span className="num">{signedMoney(together)}</span> a month in sales
              collected.
            </p>
          </div>
        ) : null}
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.link} onClick={copyLink}>
          {copied === "done"
            ? "Link copied"
            : copied === "failed"
              ? "Copy the address from the browser bar"
              : "Copy a link to this setup"}
        </button>
        {changed ? (
          <button type="button" className={styles.link} onClick={onReset}>
            Start over
          </button>
        ) : null}
      </div>
    </aside>
  );
}
