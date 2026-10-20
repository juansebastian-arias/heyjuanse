"use client";

import { DATA_QUALITY_QUERIES } from "@/core/sql/queries";
import { formatCount } from "@/lib/format";
import type { SqlState } from "@/lib/lab/sql";
import styles from "./Hood.module.css";
import { ResultTable } from "./ResultTable";
import { ShowSql } from "./ShowSql";
import { firstNumber, useQuery } from "./useQuery";

const FALSE_MERGES_SQL = `SELECT r.lead_id, COUNT(DISTINCT l.person_id) AS people
FROM lead_records r
JOIN labels l ON l.raw_id = r.raw_id
GROUP BY r.lead_id
HAVING COUNT(DISTINCT l.person_id) > 1;`;

const MISSED_SQL = `SELECT l.person_id, GROUP_CONCAT(DISTINCT r.lead_id) AS leads
FROM labels l
JOIN lead_records r ON r.raw_id = l.raw_id
GROUP BY l.person_id
HAVING COUNT(DISTINCT r.lead_id) > 1;`;

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd className="num">{value === null ? "–" : formatCount(value)}</dd>
    </div>
  );
}

export function DataQuality({ sql, onOpen }: { sql: SqlState; onOpen: (leadId: string) => void }) {
  const overview = useQuery(sql, DATA_QUALITY_QUERIES.overview.sql);
  const truth = useQuery(sql, DATA_QUALITY_QUERIES.duplicatesAgainstTruth.sql);
  const fixes = useQuery(sql, DATA_QUALITY_QUERIES.fixes.sql);
  const enrichment = useQuery(sql, DATA_QUALITY_QUERIES.enrichment.sql);
  const falseMerges = useQuery(sql, FALSE_MERGES_SQL);
  const missed = useQuery(sql, MISSED_SQL);

  const leadButtons = (ids: string[]) =>
    ids.map((id, index) => (
      <span key={id}>
        {index > 0 ? ", " : ""}
        <button type="button" className={styles.leadLink} onClick={() => onOpen(id)}>
          {id}
        </button>
      </span>
    ));

  const falseMergeIds = (falseMerges.result?.rows ?? []).map((row) => String(row[0]));
  const missedLeadIds = (missed.result?.rows ?? []).map((row) => String(row[1]).split(","));

  return (
    <section className={styles.panel} aria-labelledby="data-quality-title">
      <div className={styles.panelHead}>
        <h3 id="data-quality-title">Data quality report</h3>
        <p>
          What cleaning and duplicate detection did to this week’s records, checked against the
          answer key. The duplicate rules are deliberately cautious, and this is where their
          mistakes show.
        </p>
      </div>

      <dl className={styles.stats}>
        <Stat label="Form submissions" value={firstNumber(overview.result, "raw_records")} />
        <Stat label="Leads after merging" value={firstNumber(overview.result, "leads")} />
        <Stat label="Merges" value={firstNumber(overview.result, "merges")} />
        <Stat
          label="Pairs flagged, kept apart"
          value={firstNumber(overview.result, "flagged_pairs")}
        />
      </dl>
      <ShowSql sql={DATA_QUALITY_QUERIES.overview.sql} />

      <h4 className={styles.subhead}>Duplicates against the answer key</h4>
      <dl className={styles.stats}>
        <Stat
          label="People who submitted more than once"
          value={firstNumber(truth.result, "people_with_duplicates")}
        />
        <Stat
          label="False merges (two people as one)"
          value={firstNumber(truth.result, "false_merges")}
        />
        <Stat
          label="Missed duplicates (one person as two)"
          value={firstNumber(truth.result, "missed_duplicates")}
        />
      </dl>
      {falseMergeIds.length > 0 ? (
        <p className={styles.note}>False merges to inspect: {leadButtons(falseMergeIds)}.</p>
      ) : null}
      {missedLeadIds.length > 0 ? (
        <p className={styles.note}>
          Missed duplicates:{" "}
          {missedLeadIds.map((ids, index) => (
            <span key={ids.join("+")}>
              {index > 0 ? "; " : ""}
              {leadButtons(ids)}
            </span>
          ))}
          .
        </p>
      ) : null}
      <ShowSql
        sql={`${DATA_QUALITY_QUERIES.duplicatesAgainstTruth.sql}\n\n-- Which leads\n${FALSE_MERGES_SQL}\n\n${MISSED_SQL}`}
      />

      <h4 className={styles.subhead}>Fixes by field</h4>
      {fixes.result ? (
        <ResultTable
          columns={fixes.result.columns}
          rows={fixes.result.rows}
          caption="Cleaning changes by field and reason"
          maxHeight={300}
        />
      ) : (
        <p className={styles.hint}>Starting SQLite…</p>
      )}
      <ShowSql sql={DATA_QUALITY_QUERIES.fixes.sql} />

      <h4 className={styles.subhead}>Company matches</h4>
      {enrichment.result ? (
        <ResultTable
          columns={enrichment.result.columns}
          rows={enrichment.result.rows}
          caption="How leads were matched to the company data"
        />
      ) : null}
      <ShowSql sql={DATA_QUALITY_QUERIES.enrichment.sql} />
    </section>
  );
}
