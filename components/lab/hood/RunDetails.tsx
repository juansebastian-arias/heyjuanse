import { formatCount, formatDate } from "@/lib/format";
import type { WeekData } from "@/lib/lab/data";
import type { SqlState } from "@/lib/lab/sql";
import styles from "./Hood.module.css";

interface RunDetailsProps {
  data: WeekData;
  sql: SqlState;
  routeMs: number;
}

export function RunDetails({ data, sql, routeMs }: RunDetailsProps) {
  const messages = data.leadsFile.rawLeads.filter((raw) => raw.message !== null).length;
  const rows: Array<[string, string]> = [
    [
      "Week",
      `${data.week.label}, ${formatDate(data.week.weekStart)} to ${formatDate(data.week.weekEnd)}`,
    ],
    ["Generator", `version ${data.leadsFile.generatorVersion}, seed ${data.leadsFile.seed}`],
    ["Form submissions", formatCount(data.leadsFile.rawLeads.length)],
    ["Messages", formatCount(messages)],
    ["Leads after cleaning and merging", formatCount(data.prepared.leads.length)],
    ["Companies in the simulated data provider", formatCount(data.leadsFile.companies.length)],
    ["leads.json sha256", data.week.sha256.leads.slice(0, 16)],
    ["labels.json sha256", data.week.sha256.labels.slice(0, 16)],
  ];
  const timings: Array<[string, string]> = [
    ["Cleaning, matching and merging", `${data.prepareMs.toFixed(1)} ms, once per week`],
    ["Scoring and routing every lead", `${routeMs.toFixed(1)} ms, on every change`],
    [
      "SQL: rewrite decisions and run every metric",
      sql.status === "ready" ? `${sql.queryMs.toFixed(1)} ms, on every change` : "not ready yet",
    ],
  ];
  return (
    <section className={styles.panel} aria-labelledby="run-details-title">
      <div className={styles.panelHead}>
        <h3 id="run-details-title">This run</h3>
        <p>
          Everything on this page ran in your browser, from the files below. The page may only
          request files from this site, so nothing you do here is sent anywhere.
        </p>
      </div>
      <dl className={styles.pairList}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={label.includes("sha256") ? "num" : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      <h4 className={styles.subhead}>Timing on your device</h4>
      <dl className={styles.pairList}>
        {timings.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="num">{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>
        Download the data: <a href={`/data/${data.week.files.leads}`}>leads.json</a>,{" "}
        <a href={`/data/${data.week.files.labels}`}>labels.json</a> (the answer key)
        {data.week.files.ai ? (
          <>
            , <a href={`/data/${data.week.files.ai}`}>ai.json</a> (stored model outputs)
          </>
        ) : null}
        .
      </p>
    </section>
  );
}
