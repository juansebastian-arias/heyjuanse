"use client";

import { useId, useState } from "react";
import type { Metrics } from "@/core/backtest/metrics";
import type { Decision } from "@/core/routing/route";
import { runQuery } from "@/core/sql/load";
import { METRIC_QUERIES, type MetricId } from "@/core/sql/queries";
import { formatPercent, signed } from "@/lib/format";
import type { SqlState } from "@/lib/lab/sql";
import styles from "./MetricsPanel.module.css";

interface MetricSpec {
  id: MetricId;
  label: string;
  /** Context shown under the number. */
  context: (m: Metrics) => string;
  format?: (value: number | null) => string;
  /** Whether going up is good, for the color of the change. */
  better: "up" | "down" | "neutral";
}

const PRIMARY: MetricSpec[] = [
  {
    id: "needsReached",
    label: "Needs reached",
    context: (m) => `of ${m.needsTotal} real needs this week`,
    better: "up",
  },
  {
    id: "callsWithoutNeed",
    label: "Calls without a need",
    context: (m) => `of ${m.callsMade} calls made`,
    better: "down",
  },
  {
    id: "salesPrecision",
    label: "Calls that found a need",
    context: () => "share of this week's calls",
    format: (value) => formatPercent(value),
    better: "up",
  },
  {
    id: "needsMissed",
    label: "Needs missed",
    context: () => "sent to nurture or excluded",
    better: "down",
  },
];

const SECONDARY: MetricSpec[] = [
  {
    id: "needsWaiting",
    label: "Needs waiting",
    context: () => "qualified, over capacity",
    better: "down",
  },
  {
    id: "needsInReview",
    label: "Needs in review",
    context: () => "waiting on a person",
    better: "neutral",
  },
  {
    id: "needsFixData",
    label: "Needs stuck in data fixes",
    context: () => "bad email or no company",
    better: "down",
  },
  {
    id: "reviewCases",
    label: "Cases for human review",
    context: () => "leads, with or without a need",
    better: "neutral",
  },
];

function referenceValue(metrics: Metrics, id: MetricId): number | null {
  return metrics[id] as number | null;
}

interface MetricsPanelProps {
  metrics: Metrics;
  decisions: Decision[];
  baseline: Metrics | null;
  sql: SqlState;
  expandedByDefault: boolean;
}

function SqlDisclosure({ id, sql }: { id: MetricId; sql: SqlState }) {
  const query = METRIC_QUERIES[id];
  const result = sql.status === "ready" ? runQuery(sql.db, query) : null;
  return (
    <div className={styles.sql}>
      <p className={styles.sqlDescription}>{query.description}</p>
      <pre className={styles.code}>
        <code>{query.sql}</code>
      </pre>
      {result ? (
        <p className={styles.sqlResult}>
          Result in your browser:{" "}
          <span className="num">{String(result.rows[0]?.[0] ?? "NULL")}</span>
        </p>
      ) : (
        <p className={styles.sqlResult}>The SQL engine is still loading.</p>
      )}
    </div>
  );
}

function MetricCard({
  spec,
  metrics,
  baseline,
  sql,
  sqlCurrent,
  size,
  expandedByDefault,
}: {
  spec: MetricSpec;
  metrics: Metrics;
  baseline: Metrics | null;
  sql: SqlState;
  /** The SQL results belong to the decisions on screen. */
  sqlCurrent: boolean;
  size: "large" | "small";
  expandedByDefault: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const expanded = open || expandedByDefault;
  const reference = referenceValue(metrics, spec.id);
  const value = sql.status === "ready" && sqlCurrent ? sql.metrics[spec.id] : reference;
  const mismatch =
    sql.status === "ready" &&
    sqlCurrent &&
    (value === null || reference === null
      ? value !== reference
      : Math.abs((value ?? 0) - reference) > 1e-9);
  const format = spec.format ?? ((v: number | null) => (v === null ? "–" : String(v)));
  const before = baseline ? referenceValue(baseline, spec.id) : null;
  const delta =
    before !== null && reference !== null && spec.id !== "salesPrecision"
      ? reference - before
      : null;
  const deltaPoints =
    before !== null && reference !== null && spec.id === "salesPrecision"
      ? Math.round((reference - before) * 100)
      : null;
  const change = delta ?? deltaPoints;
  const tone =
    change === null || change === 0 || spec.better === "neutral"
      ? "neutral"
      : change > 0 === (spec.better === "up")
        ? "good"
        : "bad";

  return (
    <div className={styles.card} data-size={size} data-metric={spec.id}>
      <p className={styles.label}>{spec.label}</p>
      <p className={styles.value}>
        <span className="num">{format(value)}</span>
        {change !== null && change !== 0 ? (
          <span className={styles.delta} data-tone={tone}>
            {signed(change)}
            {deltaPoints !== null ? " pts" : ""}
          </span>
        ) : null}
      </p>
      <p className={styles.context}>{spec.context(metrics)}</p>
      {mismatch ? (
        <p className={styles.mismatch} role="alert">
          SQL and the reference implementation disagree here. Please report this.
        </p>
      ) : null}
      {expandedByDefault ? null : (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          {expanded ? "Hide SQL" : "Show SQL"}
        </button>
      )}
      {expanded ? (
        <div id={panelId}>
          <SqlDisclosure id={spec.id} sql={sql} />
        </div>
      ) : null}
    </div>
  );
}

export function MetricsPanel({
  metrics,
  decisions,
  baseline,
  sql,
  expandedByDefault,
}: MetricsPanelProps) {
  const sqlCurrent = sql.status === "ready" && sql.forDecisions === decisions;
  const status =
    sql.status === "ready"
      ? `Computed by SQLite in your browser (${sql.queryMs.toFixed(0)} ms for every query on this page).`
      : sql.status === "loading"
        ? "Starting the SQL engine. Until it is ready, these numbers come from the TypeScript reference implementation, which a test keeps identical to the SQL."
        : `The SQL engine could not start (${sql.message}). These numbers come from the TypeScript reference implementation, which a test keeps identical to the SQL.`;
  return (
    <section className={styles.panel} aria-labelledby="metrics-title">
      <div className={styles.head}>
        <h2 id="metrics-title" className={styles.title}>
          This week, with these rules <span className="tag">synthetic</span>
        </h2>
        <p className={styles.status} data-status={sql.status}>
          {status}
        </p>
      </div>
      <div className={styles.primary}>
        {PRIMARY.map((spec) => (
          <MetricCard
            key={spec.id}
            spec={spec}
            metrics={metrics}
            baseline={baseline}
            sql={sql}
            sqlCurrent={sqlCurrent}
            size="large"
            expandedByDefault={expandedByDefault}
          />
        ))}
      </div>
      <div className={styles.secondary}>
        {SECONDARY.map((spec) => (
          <MetricCard
            key={spec.id}
            spec={spec}
            metrics={metrics}
            baseline={baseline}
            sql={sql}
            sqlCurrent={sqlCurrent}
            size="small"
            expandedByDefault={expandedByDefault}
          />
        ))}
      </div>
    </section>
  );
}
