"use client";

import { type FormEvent, useMemo, useState } from "react";
import { type Plan, plan, valuePlan } from "@/core/gtm/decide";
import { ALL_OFF, AUTOMATIONS, MOTION_IDS, MOTIONS, type MotionId } from "@/core/gtm/model";
import { DecisionPath } from "./DecisionPath";
import styles from "./Diagnose.module.css";
import { formatMoney } from "./format";
import { ValueTable } from "./ValueTable";

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

/**
 * "What this could be worth at your company": the simulator run on the visitor's own numbers, as
 * an ordered plan with a dollar value per step. It opens already computed for a typical team, so
 * a reader sees the answer before typing anything.
 */
export function Diagnose() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [result, setResult] = useState<{ inputs: Inputs; plan: Plan } | null>(() =>
    build(DEFAULTS),
  );

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
    { key: "reps", label: "Reps who make first contact", hint: "1 to 15" },
    { key: "responseHours", label: "Hours until a lead first hears from you", hint: "1 to 96" },
    { key: "dealSize", label: "Average deal size, US dollars", hint: "2,000 to 150,000" },
  ];

  const start = result?.plan.start;
  const steps = result?.plan.steps ?? [];
  const end = steps[steps.length - 1]?.result ?? start;
  const first = steps[0];
  const worth = useMemo(() => (result ? valuePlan(result.plan) : null), [result]);

  return (
    <div className={styles.wrap}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>Your main strategy</span>
          <select value={inputs.motion} onChange={(event) => set("motion", event.target.value)}>
            {MOTION_IDS.map((id) => (
              <option key={id} value={id}>
                {MOTIONS[id].name}
              </option>
            ))}
          </select>
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
        <button type="submit" className="button" data-variant="primary">
          Recalculate with my numbers
        </button>
      </form>

      <div className={styles.result} aria-live="polite">
        {start && end && result && worth ? (
          <>
            <p className="eyebrow">
              {result.inputs.leadsPerMonth.toLocaleString("en-US")} leads a month,{" "}
              {result.inputs.reps === 1 ? "1 rep" : `${result.inputs.reps} reps`},{" "}
              {formatMoney(result.inputs.dealSize)} deals
            </p>
            <p className={styles.headline}>
              About <span className="num">{formatMoney(worth.total.revenuePerYear)}</span> more in
              sales a year, with the same{" "}
              {result.inputs.reps === 1 ? "rep" : `${result.inputs.reps} reps`}.
            </p>
            <p className={styles.sub}>
              Sales meetings a quarter <span className="num">{start.meetings}</span> →{" "}
              <span className="num">{end.meetings}</span>; cost of each meeting{" "}
              {formatMoney(start.costPerMeeting)} → {formatMoney(end.costPerMeeting)}.
            </p>
            {first ? (
              <p className={styles.firstMove}>
                <strong>Start with “{AUTOMATIONS[first.move.automation].name}”.</strong>
              </p>
            ) : (
              <p className={styles.firstMove}>
                With these numbers no single automation adds meetings: the constraint is the number
                of leads, not the process.
              </p>
            )}
            {steps.length ? (
              <DecisionPath
                start={{ meetings: start.meetings, costPerMeeting: start.costPerMeeting }}
                steps={steps.map((step) => ({
                  label: `${step.move.turnOn ? "" : "Off: "}${AUTOMATIONS[step.move.automation].short}`,
                  delta: step.move.deltaMeetings,
                  meetings: step.result.meetings,
                  costPerMeeting: step.result.costPerMeeting,
                }))}
                label="Your plan, step by step"
              />
            ) : null}
            <ValueTable
              value={valuePlan(result.plan)}
              label="What each step of your plan is worth"
            />
          </>
        ) : (
          <div className={styles.empty}>
            <p className={styles.headline}>Your numbers in, an ordered plan out.</p>
            <p className={styles.sub}>
              The simulator runs a quarter of your leads by hand, then keeps adding the automation
              that helps most until nothing else does. It runs in your browser; nothing you type is
              sent anywhere.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
