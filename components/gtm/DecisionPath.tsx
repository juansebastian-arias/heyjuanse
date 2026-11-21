import styles from "./DecisionPath.module.css";
import { formatMoney, formatSigned } from "./format";

export interface PathStep {
  label: string;
  /** Meetings this decision added. */
  delta: number;
  /** Meetings after this decision. */
  meetings: number;
  costPerMeeting: number;
}

/**
 * The decisions applied so far, as a staircase: each bar is the meetings after one more small
 * change, so the visitor sees how the changes add up.
 */
export function DecisionPath({
  start,
  steps,
  label = "Decisions applied",
}: {
  start: { meetings: number; costPerMeeting: number };
  steps: PathStep[];
  label?: string;
}) {
  const last = steps[steps.length - 1];
  const end = last?.meetings ?? start.meetings;
  const max = Math.max(start.meetings, ...steps.map((step) => step.meetings), 1);
  const growth = start.meetings ? Math.round((end / start.meetings - 1) * 100) : 0;
  const bars = [
    {
      key: "start",
      name: "Starting point",
      meetings: start.meetings,
      delta: null as number | null,
    },
    ...steps.map((step, index) => ({
      key: `${index}-${step.label}`,
      name: step.label,
      meetings: step.meetings,
      delta: step.delta,
    })),
  ];
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <strong>
          {steps.length} {steps.length === 1 ? "decision" : "decisions"}: {start.meetings} → {end}{" "}
          meetings ({growth >= 0 ? "+" : "−"}
          {Math.abs(growth)}%)
        </strong>
        , and each meeting went from {formatMoney(start.costPerMeeting)} to{" "}
        {formatMoney(last?.costPerMeeting ?? start.costPerMeeting)}. No single change does it; they
        add up.
      </figcaption>
      <ol className={styles.steps} aria-label={label}>
        {bars.map((bar) => (
          <li key={bar.key} className={styles.step}>
            <span className={`num ${styles.value}`}>{bar.meetings}</span>
            <span className={styles.track}>
              <span
                className={styles.bar}
                data-start={bar.delta === null || undefined}
                style={{ height: `${(bar.meetings / max) * 100}%` }}
              />
            </span>
            <span className={`num ${styles.delta}`}>
              {bar.delta === null ? "" : formatSigned(bar.delta)}
            </span>
            <span className={styles.name}>{bar.name}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
