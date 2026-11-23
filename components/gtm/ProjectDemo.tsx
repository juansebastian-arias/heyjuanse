"use client";

import { type FormEvent, useMemo, useState } from "react";
import { PLAYBOOKS } from "@/content/playbooks";
import { type Plan, plan, valuePlan } from "@/core/gtm/decide";
import {
  ALL_OFF,
  AUTOMATIONS,
  type AutomationId,
  MOTION_IDS,
  MOTIONS,
  type MotionId,
  TEAM,
} from "@/core/gtm/model";
import type { SimResult } from "@/core/gtm/simulate";
import { SITE } from "@/site.config";
import { formatHours, formatMoney, formatSigned } from "./format";
import styles from "./ProjectDemo.module.css";

interface Inputs {
  motion: MotionId;
  leadsPerMonth: number;
  reps: number;
  responseHours: number;
  dealSize: number;
}

const LIMITS = {
  leadsPerMonth: { min: 50, max: 3000, step: 50 },
  reps: { min: 1, max: 15, step: 1 },
  responseHours: { min: 1, max: 96, step: 1 },
  dealSize: { min: 2000, max: 150000, step: 1000 },
} as const;

const clamp = (value: number, key: keyof typeof LIMITS) => {
  const { min, max } = LIMITS[key];
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
};

const DEFAULTS: Inputs = {
  motion: "inbound",
  leadsPerMonth: 400,
  reps: 2,
  responseHours: 24,
  dealSize: 20000,
};

/** How many of the plan's changes go live in days 31–60. The rest follow in days 61–90. */
const FIRST_WAVE = 2;

function build(raw: Inputs): { inputs: Inputs; plan: Plan } {
  const clean: Inputs = {
    motion: raw.motion,
    leadsPerMonth: clamp(raw.leadsPerMonth, "leadsPerMonth"),
    reps: clamp(Math.round(raw.reps), "reps"),
    responseHours: clamp(raw.responseHours, "responseHours"),
    dealSize: clamp(raw.dealSize, "dealSize"),
  };
  return {
    inputs: clean,
    plan: plan(clean.motion, ALL_OFF, {
      leads: clean.leadsPerMonth * 3,
      reps: clean.reps,
      manualRoutingHours: clean.responseHours,
      dealSize: clean.dealSize,
    }),
  };
}

/** Where on this page a change can be seen working. */
function demoOf(id: AutomationId): { label: string; href: string } | null {
  if (id === "aiDrafts") return { label: "Try it in the AI agent", href: "#agent" };
  if (id === "instantRouting") return { label: "See it in the AI agent", href: "#agent" };
  const playbook = PLAYBOOKS.find((candidate) => candidate.simulator === id);
  return playbook ? { label: "How it works", href: `#${playbook.id}` } : null;
}

const reps = (count: number) => (count === 1 ? "1 rep" : `${count} reps`);

const meetingsLabel = (count: number) =>
  `${formatSigned(count)} ${Math.abs(count) === 1 ? "meeting" : "meetings"}`;

interface Change {
  id: AutomationId;
  name: string;
  meetings: number;
  revenue: number;
}

interface Phase {
  when: string;
  title: string;
  /** Meetings a quarter once the phase is done. */
  meetings: number;
  meetingsNote: string;
  findings?: string[];
  changes?: Change[];
  empty?: string;
  get: string;
}

function phasesOf(start: SimResult, steps: Plan["steps"], changes: Change[]): Phase[] {
  const findings = [
    `Half of new leads wait more than ${formatHours(start.medianHoursToTouch)} for a first answer.`,
  ];
  if (start.missedNeeds > 0) {
    findings.push(
      `Each quarter, ${start.missedNeeds} ${start.missedNeeds === 1 ? "lead with a real need never hears" : "leads with a real need never hear"} back.`,
    );
  }
  if (start.wastedHours >= 1) {
    findings.push(
      `Reps spend ${Math.round(start.wastedHours)} hours a quarter on duplicate records.`,
    );
  }
  const measure: Phase = {
    when: "Days 1–30",
    title: "Measure",
    meetings: start.meetings,
    meetingsNote: "today",
    findings,
    get: "A one-page baseline, and every change below priced before anything is built.",
  };
  if (changes.length === 0) return [measure];

  const first = changes.slice(0, FIRST_WAVE);
  const rest = changes.slice(FIRST_WAVE);
  const afterFirst = steps[first.length - 1]?.result ?? start;
  const end = steps[steps.length - 1]?.result ?? afterFirst;
  return [
    measure,
    {
      when: "Days 31–60",
      title: first.length === 1 ? "Build the biggest win" : "Build the two biggest wins",
      meetings: afterFirst.meetings,
      meetingsNote: "",
      changes: first,
      get: "The biggest wins live, with a control group kept aside to prove them.",
    },
    {
      when: "Days 61–90",
      title: rest.length ? "Add the rest, and prove it" : "Prove it",
      meetings: end.meetings,
      meetingsNote: "",
      changes: rest,
      empty: "Nothing else adds meetings at these numbers.",
      get: "A report against the control group, in meetings and dollars, and what to build next.",
    },
  ];
}

/**
 * A demo project at the visitor's company: the simulator run on their numbers, laid out as the
 * first 90 days of work, with what each phase finds or builds and what it is worth. It opens
 * already computed for a typical team, so a reader sees the answer before typing anything.
 */
export function ProjectDemo() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [result, setResult] = useState(() => build(DEFAULTS));

  const set = (key: keyof Inputs, value: string) =>
    setInputs((prev) => ({
      ...prev,
      [key]: key === "motion" ? (value as MotionId) : Number(value),
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = build(inputs);
    setInputs(next.inputs);
    setResult(next);
  };

  const fields: { key: Exclude<keyof Inputs, "motion">; label: string; hint: string }[] = [
    { key: "leadsPerMonth", label: "New leads a month", hint: "50 to 3,000" },
    { key: "reps", label: "Reps on new leads", hint: "1 to 15" },
    { key: "responseHours", label: "Hours to assign a lead", hint: "1 to 96" },
    { key: "dealSize", label: "Average deal, US$", hint: "2,000 to 150,000" },
  ];

  const worth = useMemo(() => valuePlan(result.plan), [result]);
  const { start, steps } = result.plan;
  const end = steps[steps.length - 1]?.result ?? start;
  const changes: Change[] = worth.steps.map((step, index) => ({
    id: step.automation,
    name: `${steps[index]?.move.turnOn === false ? "Switch off: " : ""}${AUTOMATIONS[step.automation].name}`,
    meetings: step.meetingsPerQuarter,
    revenue: step.revenuePerYear,
  }));
  const phases = phasesOf(start, steps, changes);
  const top = Math.max(end.meetings, start.meetings, 1);
  const linkedin = SITE.contact.linkedin;

  return (
    <div className={styles.wrap}>
      <form className={styles.form} onSubmit={submit} aria-label="Your company">
        <label className={styles.field}>
          <span className={styles.label}>Lead source</span>
          <select value={inputs.motion} onChange={(event) => set("motion", event.target.value)}>
            {MOTION_IDS.map((id) => (
              <option key={id} value={id}>
                {MOTIONS[id].name}
              </option>
            ))}
          </select>
          <span className={styles.hint}>Your main strategy</span>
        </label>
        {fields.map((field) => (
          <label key={field.key} className={styles.field}>
            <span className={styles.label}>{field.label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={LIMITS[field.key].min}
              max={LIMITS[field.key].max}
              step={LIMITS[field.key].step}
              value={inputs[field.key]}
              onChange={(event) => set(field.key, event.target.value)}
            />
            <span className={styles.hint}>{field.hint}</span>
          </label>
        ))}
        <button type="submit" className={`button ${styles.submit}`} data-variant="primary">
          Recalculate with my numbers
        </button>
      </form>

      <div className={styles.result} aria-live="polite">
        <p className="eyebrow">
          {MOTIONS[result.inputs.motion].name} ·{" "}
          {result.inputs.leadsPerMonth.toLocaleString("en-US")} leads a month ·{" "}
          {reps(result.inputs.reps)} · {formatMoney(result.inputs.dealSize)} deals
        </p>
        {changes.length ? (
          <>
            <p className={styles.headline}>
              By day 90: about {formatMoney(worth.total.revenuePerYear)} more in sales a year, with
              the same {reps(result.inputs.reps)}.
            </p>
            <dl className={styles.deltas}>
              <div>
                <dt>Sales meetings a quarter</dt>
                <dd className="num">
                  {start.meetings} → {end.meetings}
                </dd>
              </div>
              <div>
                <dt>Time to first answer</dt>
                <dd className="num">
                  {formatHours(start.medianHoursToTouch)} → {formatHours(end.medianHoursToTouch)}
                </dd>
              </div>
              <div>
                <dt>Cost of each meeting</dt>
                <dd className="num">
                  {formatMoney(start.costPerMeeting)} → {formatMoney(end.costPerMeeting)}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className={styles.headline}>
            At these numbers the limit is the number of leads, not the process. Day 30 says so
            before anything is built.
          </p>
        )}

        <ol className={styles.timeline} aria-label="Your 90-day project">
          {phases.map((phase) => (
            <li key={phase.when} className={styles.phase}>
              <p className={`num ${styles.when}`}>{phase.when}</p>
              <h3 className={styles.title}>{phase.title}</h3>
              <div className={styles.meter} aria-hidden="true">
                <span style={{ width: `${(phase.meetings / top) * 100}%` }} />
              </div>
              <p className={styles.meetings}>
                <span className="num">{phase.meetings}</span> meetings a quarter
                {phase.meetingsNote ? `, ${phase.meetingsNote}` : ""}
              </p>
              {phase.findings ? (
                <ul className={styles.findings}>
                  {phase.findings.map((finding) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
              ) : null}
              {phase.changes ? (
                phase.changes.length ? (
                  <ul className={styles.changes}>
                    {phase.changes.map((change) => {
                      const demo = demoOf(change.id);
                      return (
                        <li key={change.id}>
                          <span className={styles.changeName}>{change.name}</span>
                          <span className={styles.changeValue}>
                            {meetingsLabel(change.meetings)}
                            {Math.round(change.revenue / 1000) > 0
                              ? ` · ≈${formatMoney(change.revenue)} in sales a year`
                              : ""}
                          </span>
                          {demo ? (
                            <a href={demo.href} className={styles.changeLink}>
                              {demo.label} ↓
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={styles.empty}>{phase.empty}</p>
                )
              ) : null}
              <p className={styles.get}>
                <span className={styles.getLabel}>You get</span> {phase.get}
              </p>
            </li>
          ))}
        </ol>

        <p className={styles.note}>
          A simulation of a company with your numbers and made-up leads: an estimate, not a promise.
          Sales a year = extra pipeline × {Math.round(TEAM.winRate * 100)}% win rate × 4 quarters. A
          real project starts by measuring your actual numbers.
        </p>
        <p className={styles.past}>
          I have built systems like these before for sales teams.
          {linkedin ? (
            <>
              {" "}
              Roles and results are on{" "}
              <a href={linkedin} rel="noopener noreferrer">
                my LinkedIn
              </a>
              .
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
