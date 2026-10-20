/**
 * Loading data into SQLite and running the published queries. Works with sql.js in the browser
 * and in Node, through the small interface below.
 */
import type { PreparedWeek } from "../cleaning/pipeline";
import type { LabelsFile } from "../data/files";
import type { Decision, Lane } from "../routing/route";
import { METRIC_QUERIES, type MetricId, type NamedQuery } from "./queries";
import { SCHEMA_SQL } from "./schema";

type SqlValue = string | number | null | Uint8Array;

export interface SqlStatement {
  run(params?: SqlValue[]): void;
  free(): unknown;
}

export interface SqlDatabase {
  run(sql: string, params?: SqlValue[]): unknown;
  exec(sql: string): Array<{ columns: string[]; values: SqlValue[][] }>;
  prepare(sql: string): SqlStatement;
}

export interface QueryResult {
  columns: string[];
  rows: SqlValue[][];
}

function insertAll(db: SqlDatabase, sql: string, rows: SqlValue[][]): void {
  const statement = db.prepare(sql);
  try {
    for (const row of rows) statement.run(row);
  } finally {
    statement.free();
  }
}

const bool = (value: boolean) => (value ? 1 : 0);

/** Create the schema and load everything that does not depend on the dials. */
export function loadWeek(db: SqlDatabase, prepared: PreparedWeek, labels: LabelsFile): void {
  db.exec(SCHEMA_SQL);
  db.exec("BEGIN");
  insertAll(
    db,
    "INSERT INTO raw_leads VALUES (?, ?, ?, ?, ?, ?, ?)",
    prepared.records.map((r) => [
      r.rawId,
      r.receivedAt,
      r.source,
      r.email,
      r.companyName,
      r.country,
      bool(r.message !== null),
    ]),
  );
  insertAll(
    db,
    "INSERT INTO leads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    prepared.leads.map((lead) => [
      lead.leadId,
      lead.firstTouchAt,
      [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null,
      lead.email,
      lead.emailStatus,
      bool(lead.isFreemail),
      lead.companyName,
      lead.match?.company.id ?? null,
      lead.match?.method ?? null,
      lead.match?.company.industry ?? null,
      lead.match?.company.sizeBand ?? null,
      lead.region,
      lead.country,
      bool(lead.suppressed),
      lead.rawIds.length,
      lead.messages.length,
    ]),
  );
  insertAll(
    db,
    "INSERT INTO lead_records VALUES (?, ?)",
    prepared.leads.flatMap((lead) => lead.rawIds.map((rawId) => [rawId, lead.leadId])),
  );
  insertAll(
    db,
    "INSERT INTO cleaning_changes VALUES (?, ?, ?)",
    prepared.records.flatMap((r) => r.changes.map((c) => [r.rawId, c.field, c.reason])),
  );
  insertAll(
    db,
    "INSERT INTO duplicate_links VALUES (?, ?, ?)",
    prepared.dedupe.links.map((link) => [link.a, link.b, link.rule]),
  );
  insertAll(
    db,
    "INSERT INTO duplicate_flags VALUES (?, ?, ?)",
    prepared.dedupe.flags.map((flag) => [flag.a, flag.b, flag.rule]),
  );
  insertAll(
    db,
    "INSERT INTO labels VALUES (?, ?, ?, ?)",
    labels.people.flatMap((person) =>
      person.rawIds.map((rawId) => [rawId, person.personId, bool(person.hasNeed), person.persona]),
    ),
  );
  db.exec("COMMIT");
}

/** Replace the decisions table with the engine's latest output. */
export function writeDecisions(db: SqlDatabase, decisions: Decision[]): void {
  db.exec("BEGIN");
  db.exec("DELETE FROM decisions");
  insertAll(
    db,
    "INSERT INTO decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    decisions.map((d) => [
      d.leadId,
      d.lane,
      d.reason,
      d.score.total,
      d.score.groups.fit,
      d.score.groups.intent,
      d.score.groups.ai,
      bool(d.aiUsed),
      d.laneWithoutAi,
      d.queuePosition,
      bool(d.called),
    ]),
  );
  db.exec("COMMIT");
}

export function runQuery(db: SqlDatabase, query: NamedQuery | string): QueryResult {
  const sql = typeof query === "string" ? query : query.sql;
  const [result] = db.exec(sql);
  return { columns: result?.columns ?? [], rows: result?.values ?? [] };
}

function scalar(db: SqlDatabase, query: NamedQuery): number | null {
  const value = runQuery(db, query).rows[0]?.[0];
  return typeof value === "number" ? value : null;
}

export type SqlMetrics = Record<MetricId, number | null> & { laneCounts: Record<Lane, number> };

export function runMetrics(db: SqlDatabase): SqlMetrics {
  const values = Object.fromEntries(
    (Object.keys(METRIC_QUERIES) as MetricId[]).map((id) => [id, scalar(db, METRIC_QUERIES[id])]),
  ) as Record<MetricId, number | null>;
  const laneCounts: Record<Lane, number> = {
    sales: 0,
    review: 0,
    nurture: 0,
    fix_data: 0,
    not_for_sales: 0,
  };
  for (const [lane, count] of runQuery(db, "SELECT lane, COUNT(*) FROM decisions GROUP BY lane")
    .rows) {
    laneCounts[lane as Lane] = Number(count);
  }
  return { ...values, laneCounts };
}
