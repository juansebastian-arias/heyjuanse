import type { Automations } from "@/core/gtm/model";
import type { SimResult } from "@/core/gtm/simulate";
import styles from "./FlowDiagram.module.css";
import { formatHours, formatMoney } from "./format";

interface Step {
  name: string;
  count: string;
  detail: string;
  /** null for steps that are not an automation choice. */
  automated: boolean | null;
}

export function FlowDiagram({
  result,
  automations,
}: {
  result: SimResult;
  automations: Automations;
}) {
  const { stages } = result;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const steps: Step[] = [
    {
      name: "Lead captured",
      count: fmt(stages.captured),
      detail: "Forms, sign-ups, lists and badge scans",
      automated: null,
    },
    {
      name: "Deduplicated",
      count: fmt(stages.unique),
      detail: automations.dedupe
        ? `${fmt(stages.captured - stages.unique)} copies merged`
        : `Copies reach reps: ${Math.round(result.wastedHours)} h wasted`,
      automated: automations.dedupe,
    },
    {
      name: "Enriched",
      count: fmt(stages.enriched),
      detail: automations.enrichment ? "Company data filled in" : "Reps look companies up by hand",
      automated: automations.enrichment,
    },
    {
      name: "Scored",
      count: automations.scoring ? fmt(stages.prioritized) : "–",
      detail: automations.scoring
        ? `Best first; ${fmt(stages.nurtured)} to nurture`
        : "First come, first served",
      automated: automations.scoring,
    },
    {
      name: "Routed to a rep",
      count: fmt(stages.worked),
      detail: `First touch after ${formatHours(result.medianHoursToTouch)} (median)`,
      automated: automations.instantRouting,
    },
    {
      name: automations.aiDrafts ? "AI drafts, rep approves" : "Rep writes by hand",
      count: automations.aiDrafts ? fmt(stages.aiDrafted) : fmt(stages.worked),
      detail: `${Math.round(result.repHours)} rep hours in the quarter`,
      automated: automations.aiDrafts,
    },
    {
      name: "Meeting booked",
      count: fmt(result.meetings),
      detail: automations.signals
        ? `${fmt(result.signalMeetings)} came back through a buying signal`
        : "Leads that were not ready are forgotten",
      automated: null,
    },
    {
      name: "Opportunity",
      count: fmt(result.opportunities),
      detail: `${formatMoney(result.pipeline)} pipeline`,
      automated: null,
    },
  ];

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        The flow, step by step. Blue steps run on their own; grey steps are done by hand.
      </figcaption>
      <ol className={styles.flow}>
        {steps.map((step) => (
          <li
            key={step.name}
            className={styles.step}
            data-mode={step.automated === null ? "fixed" : step.automated ? "auto" : "manual"}
          >
            <span className={styles.mode}>
              {step.automated === null ? "" : step.automated ? "Automated" : "Manual"}
            </span>
            <span className={styles.name}>{step.name}</span>
            <span className={`num ${styles.count}`}>{step.count}</span>
            <span className={styles.detail}>{step.detail}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
