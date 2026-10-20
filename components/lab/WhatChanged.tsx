"use client";

import { useEffect, useState } from "react";
import type { Explanation } from "@/core/backtest/explain";
import styles from "./WhatChanged.module.css";

export interface Experiment {
  id: string;
  label: string;
  /** One line on what the experiment tests. */
  question: string;
  apply: () => void;
}

interface WhatChangedProps {
  explanation: Explanation | null;
  experiments: Experiment[];
  onUndo: (() => void) | null;
}

/** Text for screen readers, announced once the dials have been still for a moment. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export function WhatChanged({ explanation, experiments, onUndo }: WhatChangedProps) {
  const announcement = explanation
    ? [explanation.change, explanation.effect, explanation.insight].filter(Boolean).join(" ")
    : "";
  const settledAnnouncement = useSettled(announcement, 900);

  return (
    <section className={styles.panel} aria-labelledby="what-changed-title">
      <p className="visually-hidden" aria-live="polite">
        {settledAnnouncement}
      </p>
      {explanation ? (
        <>
          <div className={styles.head}>
            <h2 id="what-changed-title" className={styles.title}>
              What changed
            </h2>
            {onUndo ? (
              <button type="button" className={styles.undo} onClick={onUndo}>
                Undo this change
              </button>
            ) : null}
          </div>
          <p className={styles.change}>{explanation.change}</p>
          <p className={styles.movement}>{explanation.movement}</p>
          <p className={styles.effect}>{explanation.effect}</p>
          {explanation.insight ? (
            <p className={styles.insight}>
              <span className={styles.insightLabel}>Why</span> {explanation.insight}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.head}>
            <h2 id="what-changed-title" className={styles.title}>
              Try one change
            </h2>
          </div>
          <p className={styles.prompt}>
            Each change re-runs the rules on the same week of leads. The lab then says which leads
            moved, what happened to the numbers, and why.
          </p>
          <ul className={styles.experiments}>
            {experiments.map((experiment) => (
              <li key={experiment.id}>
                <button type="button" className={styles.experiment} onClick={experiment.apply}>
                  <span className={styles.experimentLabel}>{experiment.label}</span>
                  <span className={styles.experimentQuestion}>{experiment.question}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
