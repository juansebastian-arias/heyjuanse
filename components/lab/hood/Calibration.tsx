"use client";

import { useState } from "react";
import { SCORE_CALIBRATION_QUERY } from "@/core/sql/queries";
import { formatPercent } from "@/lib/format";
import type { SqlState } from "@/lib/lab/sql";
import styles from "./Hood.module.css";
import { ShowSql } from "./ShowSql";
import { useQuery } from "./useQuery";

interface Band {
  start: number;
  leads: number;
  withNeed: number;
}

const BANDS = Array.from({ length: 10 }, (_, index) => index * 10);
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function bandLabel(start: number): string {
  return start === 90 ? "90–100" : `${start}–${start + 9}`;
}

function splitSql(threshold: number): string {
  return `SELECT d.score >= ${threshold} AS above_threshold,
       COUNT(*) AS leads,
       SUM(t.has_need) AS with_need
FROM decisions d
JOIN lead_truth t ON t.lead_id = d.lead_id
WHERE d.reason IN ('SCORE_ABOVE_THRESHOLD', 'SCORE_BELOW_THRESHOLD')
GROUP BY above_threshold;`;
}

export function Calibration({ sql, threshold }: { sql: SqlState; threshold: number }) {
  const query = useQuery(sql, SCORE_CALIBRATION_QUERY.sql);
  const split = useQuery(sql, splitSql(threshold));
  const [active, setActive] = useState<number | null>(null);

  const byStart = new Map<number, Band>();
  for (const row of query.result?.rows ?? []) {
    const start = Math.min(90, Number(row[0]));
    const existing = byStart.get(start) ?? { start, leads: 0, withNeed: 0 };
    existing.leads += Number(row[1]);
    existing.withNeed += Number(row[2]);
    byStart.set(start, existing);
  }
  const bands: Band[] = BANDS.map(
    (start) => byStart.get(start) ?? { start, leads: 0, withNeed: 0 },
  );

  const side = (above: number) => {
    const row = split.result?.rows.find((r) => Number(r[0]) === above);
    return row ? { leads: Number(row[1]), withNeed: Number(row[2]) } : { leads: 0, withNeed: 0 };
  };
  const above = side(1);
  const below = side(0);

  return (
    <section className={styles.panel} aria-labelledby="calibration-title">
      <div className={styles.panelHead}>
        <h3 id="calibration-title">Does the score rank leads well?</h3>
        <p>
          For leads that passed every eligibility rule, the share that really had a need, by score.
          A useful score climbs from left to right. Bands with few leads are noisy.
        </p>
      </div>

      {query.result ? (
        <figure className={styles.figure}>
          <figcaption className={styles.figcaption}>
            Share with a real need, by score band
          </figcaption>
          <div className={styles.chart}>
            <div className={styles.yAxis} aria-hidden="true">
              {TICKS.map((tick) => (
                <span key={tick} style={{ bottom: `${tick * 100}%` }}>
                  {formatPercent(tick)}
                </span>
              ))}
            </div>
            <div className={styles.plot}>
              {TICKS.map((tick) => (
                <span
                  key={tick}
                  className={styles.gridline}
                  style={{ bottom: `${tick * 100}%` }}
                  aria-hidden="true"
                />
              ))}
              <ul className={styles.columns} aria-label="Score bands">
                {bands.map((band) => {
                  const rate = band.leads > 0 ? band.withNeed / band.leads : 0;
                  const label = `Score ${bandLabel(band.start)}: ${
                    band.leads === 0
                      ? "no leads"
                      : `${band.withNeed} of ${band.leads} leads had a real need, ${formatPercent(rate)}`
                  }`;
                  return (
                    <li
                      key={band.start}
                      className={styles.column}
                      // biome-ignore lint/a11y/noNoninteractiveTabindex: each bar shows its values on focus, as it does on hover
                      tabIndex={0}
                      aria-label={label}
                      onPointerEnter={() => setActive(band.start)}
                      onPointerLeave={() =>
                        setActive((current) => (current === band.start ? null : current))
                      }
                      onFocus={() => setActive(band.start)}
                      onBlur={() =>
                        setActive((current) => (current === band.start ? null : current))
                      }
                      data-active={active === band.start || undefined}
                    >
                      {band.leads > 0 ? (
                        <span className={styles.bar} style={{ height: `${rate * 100}%` }} />
                      ) : null}
                      {active === band.start ? (
                        <span className={styles.tooltip} role="presentation">
                          <strong>{band.leads > 0 ? formatPercent(rate) : "No leads"}</strong>
                          <span>
                            {band.withNeed} of {band.leads} · score {bandLabel(band.start)}
                          </span>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <span
                className={styles.threshold}
                style={{ left: `${threshold}%` }}
                aria-hidden="true"
              >
                <span>Threshold {threshold}</span>
              </span>
            </div>
          </div>
          <div className={styles.xAxis} aria-hidden="true">
            {bands.map((band) => (
              <span key={band.start}>
                {bandLabel(band.start)}
                <small>n={band.leads}</small>
              </span>
            ))}
          </div>
        </figure>
      ) : (
        <p className={styles.hint}>Starting SQLite…</p>
      )}

      {split.result ? (
        <p className={styles.note}>
          At or above the threshold of {threshold}:{" "}
          <strong>{above.leads > 0 ? formatPercent(above.withNeed / above.leads) : "–"}</strong> had
          a real need ({above.withNeed} of {above.leads}). Below it:{" "}
          <strong>{below.leads > 0 ? formatPercent(below.withNeed / below.leads) : "–"}</strong> (
          {below.withNeed} of {below.leads}).
        </p>
      ) : null}

      <details className={styles.schema}>
        <summary>The same numbers as a table</summary>
        <div className={styles.resultScroll}>
          <table className={styles.result}>
            <caption className="visually-hidden">Leads and real needs by score band</caption>
            <thead>
              <tr>
                <th scope="col">Score</th>
                <th scope="col">Leads</th>
                <th scope="col">With a real need</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((band) => (
                <tr key={band.start}>
                  <th scope="row">{bandLabel(band.start)}</th>
                  <td data-type="number">{band.leads}</td>
                  <td data-type="number">{band.withNeed}</td>
                  <td data-type="number">
                    {band.leads > 0 ? formatPercent(band.withNeed / band.leads) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <ShowSql sql={`${SCORE_CALIBRATION_QUERY.sql}\n\n${splitSql(threshold)}`} />
    </section>
  );
}
