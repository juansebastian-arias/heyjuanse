"use client";

import { useId } from "react";
import { AI_POLICY_LABELS, type AiPolicy } from "@/core/ai/signals";
import type { ManifestWeek } from "@/core/data/files";
import { QUEUE_ORDER_LABELS, type QueueOrder } from "@/core/routing/route";
import type { ScoreGroup } from "@/core/scoring/score";
import {
  DEFAULT_SETTINGS,
  type ExtractionSource,
  type LabSettings,
  LIMITS,
  type ViewMode,
} from "@/core/settings";
import { formatDate } from "@/lib/format";
import styles from "./Dials.module.css";

interface DialsProps {
  settings: LabSettings;
  onChange: (next: LabSettings) => void;
  weeks: ManifestWeek[];
  mode: ViewMode;
  /** Stored model outputs exist for this week. */
  modelOutputs: { model: string; generatedAt: string } | null;
  disabled: boolean;
}

function weekRange(week: ManifestWeek): string {
  return `${formatDate(week.weekStart).replace(/, \d{4}$/, "")} – ${formatDate(week.weekEnd)}`;
}

function Segmented<T extends string>(props: {
  legend: string;
  hint?: string;
  name: string;
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className={styles.field} disabled={props.disabled}>
      <legend className={styles.label}>{props.legend}</legend>
      <div className={styles.segmented}>
        {props.options.map((option) => (
          <label
            key={option.value}
            className={styles.segment}
            data-disabled={option.disabled || undefined}
          >
            <input
              type="radio"
              name={props.name}
              value={option.value}
              checked={props.value === option.value}
              disabled={option.disabled}
              onChange={() => props.onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {props.hint ? <p className={styles.hint}>{props.hint}</p> : null}
    </fieldset>
  );
}

function Range(props: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  format?: (value: number) => string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const shown = props.format ? props.format(props.value) : String(props.value);
  return (
    <div className={styles.field}>
      <div className={styles.rangeHead}>
        <label htmlFor={id} className={styles.label}>
          {props.label}
        </label>
        <output htmlFor={id} className={styles.output}>
          {shown}
          {props.unit ? <span className={styles.unit}> {props.unit}</span> : null}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        aria-describedby={hintId}
        aria-valuetext={`${shown}${props.unit ? ` ${props.unit}` : ""}`}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
      <p id={hintId} className={styles.hint}>
        {props.hint}
      </p>
    </div>
  );
}

const GROUP_LABELS: Record<ScoreGroup, string> = {
  fit: "Fit points",
  intent: "Intent points",
  ai: "AI points",
};

export function Dials({ settings, onChange, weeks, mode, modelOutputs, disabled }: DialsProps) {
  const set = <K extends keyof LabSettings>(key: K, value: LabSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const aiSource = settings.extraction === "answer_key" || modelOutputs !== null;
  const isDefault =
    JSON.stringify({ ...settings, week: DEFAULT_SETTINGS.week }) ===
    JSON.stringify(DEFAULT_SETTINGS);

  const aiHint = !aiSource
    ? "Stored AI outputs for this week have not been generated yet, so AI stays off."
    : settings.extraction === "answer_key"
      ? "Using the answer key as if extraction were perfect. This is an upper bound, not AI output."
      : `Uses answers stored from a ${modelOutputs?.model} run on ${modelOutputs ? formatDate(modelOutputs.generatedAt) : ""}. Untrusted signals that would change a lane go to human review.`;

  return (
    <form
      className={styles.dials}
      aria-label="Lab settings"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className={styles.field}>
        <label htmlFor="lab-week" className={styles.label}>
          Week of data
        </label>
        <select
          id="lab-week"
          className={styles.select}
          value={settings.week}
          disabled={disabled}
          onChange={(event) => set("week", event.target.value)}
        >
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {week.label} · {weekRange(week)}
            </option>
          ))}
        </select>
      </div>

      <Range
        label="Sales calls this week"
        hint="How many leads the sales team can call. Everyone else above the threshold waits."
        value={settings.capacity}
        min={LIMITS.capacity.min}
        max={LIMITS.capacity.max}
        step={LIMITS.capacity.step}
        unit="calls"
        disabled={disabled}
        onChange={(value) => set("capacity", value)}
      />

      <Range
        label="Score threshold"
        hint="The minimum score, out of 100, to join the sales queue."
        value={settings.threshold}
        min={LIMITS.threshold.min}
        max={LIMITS.threshold.max}
        step={LIMITS.threshold.step}
        disabled={disabled}
        onChange={(value) => set("threshold", value)}
      />

      <Segmented<AiPolicy>
        legend="AI signals from messages"
        name="ai-policy"
        value={aiSource ? settings.aiPolicy : "off"}
        disabled={disabled}
        options={(["off", "high", "high_medium"] as const).map((value) => ({
          value,
          label: AI_POLICY_LABELS[value],
          disabled: value !== "off" && !aiSource,
        }))}
        hint={aiHint}
        onChange={(value) => set("aiPolicy", value)}
      />

      <Segmented<QueueOrder>
        legend="Sales queue order"
        name="queue-order"
        value={settings.queueOrder}
        disabled={disabled}
        options={(["score", "arrival"] as const).map((value) => ({
          value,
          label: QUEUE_ORDER_LABELS[value],
        }))}
        onChange={(value) => set("queueOrder", value)}
      />

      {mode === "hood" ? (
        <div className={styles.advanced}>
          <p className={styles.advancedTitle}>Under the hood</p>
          {(["fit", "intent", "ai"] as const).map((group) => (
            <Range
              key={group}
              label={GROUP_LABELS[group]}
              hint={
                group === "fit"
                  ? "Industry, company size and region. Up to 40 points before weighting."
                  : group === "intent"
                    ? "Source, web activity and recency. Up to 40 points before weighting."
                    : "Timeline, budget, intent and next step from the message. −10 to +25 before weighting."
              }
              value={settings.weights[group]}
              min={LIMITS.weight.min}
              max={LIMITS.weight.max}
              step={LIMITS.weight.step}
              format={(value) => `×${value.toFixed(1)}`}
              disabled={disabled}
              onChange={(value) =>
                onChange({ ...settings, weights: { ...settings.weights, [group]: value } })
              }
            />
          ))}
          <Segmented<ExtractionSource>
            legend="Where AI signals come from"
            name="extraction"
            value={settings.extraction}
            disabled={disabled}
            options={[
              {
                value: "model",
                label: modelOutputs
                  ? `Stored ${modelOutputs.model} run`
                  : "Stored model run (not generated)",
                disabled: modelOutputs === null,
              },
              { value: "answer_key", label: "Answer key (upper bound)" },
            ]}
            hint="The answer key shows what perfect extraction would achieve. It is never presented as AI output."
            onChange={(value) => set("extraction", value)}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={`button ${styles.reset}`}
        data-variant="quiet"
        disabled={disabled || isDefault}
        onClick={() => onChange({ ...DEFAULT_SETTINGS, week: settings.week })}
      >
        Reset to defaults
      </button>
    </form>
  );
}
