"use client";

import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { AI_CHANGES_QUERY, LANE_COUNTS_QUERY, type NamedQuery } from "@/core/sql/queries";
import { SCHEMA_SQL } from "@/core/sql/schema";
import { type ConsoleResult, runReadOnly, type SqlState } from "@/lib/lab/sql";
import styles from "./Hood.module.css";
import { ResultTable } from "./ResultTable";

const PRESETS: NamedQuery[] = [
  {
    id: "queue",
    title: "The sales queue",
    description: "Everyone who cleared the threshold, in the order sales would call them.",
    sql: `SELECT d.queue_position AS pos, d.lead_id, l.company, d.score,
       d.called, t.has_need
FROM decisions d
JOIN leads l ON l.lead_id = d.lead_id
JOIN lead_truth t ON t.lead_id = d.lead_id
WHERE d.lane = 'sales'
ORDER BY d.queue_position;`,
  },
  {
    id: "reasons",
    title: "Reasons per lane",
    description: "Every lead has exactly one reason. How many of each, and how many had a need.",
    sql: `SELECT d.lane, d.reason, COUNT(*) AS leads,
       SUM(t.has_need) AS with_need
FROM decisions d
JOIN lead_truth t ON t.lead_id = d.lead_id
GROUP BY d.lane, d.reason
ORDER BY d.lane, leads DESC;`,
  },
  {
    id: "outcomes",
    title: "What happened to each need",
    description: "One row per real need, with the best thing that happened to it.",
    sql: `SELECT outcome, COUNT(*) AS needs
FROM need_outcomes
GROUP BY outcome
ORDER BY needs DESC;`,
  },
  {
    id: "sources",
    title: "Needs by source",
    description: "Which forms the people with a real need came through.",
    sql: `SELECT r.source,
       COUNT(DISTINCT l.person_id) AS people,
       COUNT(DISTINCT CASE WHEN l.has_need = 1 THEN l.person_id END) AS with_need
FROM raw_leads r
JOIN labels l ON l.raw_id = r.raw_id
GROUP BY r.source
ORDER BY with_need DESC;`,
  },
  LANE_COUNTS_QUERY,
  AI_CHANGES_QUERY,
];

interface SqlConsoleProps {
  sql: SqlState;
  onOpen: (leadId: string) => void;
}

export function SqlConsole({ sql, onOpen }: SqlConsoleProps) {
  const [text, setText] = useState(PRESETS[0]?.sql ?? "");
  const [ran, setRan] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<
    { kind: "ok"; result: ConsoleResult } | { kind: "error"; message: string } | null
  >(null);
  const editorId = useId();
  const presetId = useId();
  const version = sql.status === "ready" ? sql.version : 0;
  const lastVersion = useRef(version);

  const execute = useCallback(
    (query: string) => {
      if (sql.status !== "ready") return;
      try {
        setOutcome({ kind: "ok", result: runReadOnly(sql.db, query) });
      } catch (error) {
        setOutcome({
          kind: "error",
          message: error instanceof Error ? error.message : "The query failed.",
        });
      }
      setRan(query);
    },
    [sql],
  );

  // Run the first preset once the engine is ready, and re-run the last query when the dials move.
  useEffect(() => {
    if (sql.status !== "ready") return;
    if (ran === null) {
      execute(text);
    } else if (lastVersion.current !== version) {
      execute(ran);
    }
    lastVersion.current = version;
  }, [sql.status, version, ran, text, execute]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      execute(text);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="sql-console-title">
      <div className={styles.panelHead}>
        <h3 id="sql-console-title">SQL console</h3>
        <p>
          The same SQLite database the metrics come from, running in your browser. The decisions
          table is rewritten every time you move a dial. Read-only: one SELECT at a time.
        </p>
      </div>
      <div className={styles.consoleBar}>
        <label htmlFor={presetId}>Start from</label>
        <select
          id={presetId}
          onChange={(event) => {
            const preset = PRESETS.find((p) => p.id === event.target.value);
            if (preset) {
              setText(preset.sql);
              execute(preset.sql);
            }
          }}
          defaultValue={PRESETS[0]?.id}
        >
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.title}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor={editorId} className="visually-hidden">
        SQL query
      </label>
      <textarea
        id={editorId}
        className={styles.editor}
        value={text}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={Math.min(14, Math.max(6, text.split("\n").length + 1))}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className={styles.consoleBar}>
        <button
          type="button"
          className="button"
          data-variant="primary"
          disabled={sql.status !== "ready"}
          onClick={() => execute(text)}
        >
          Run query
        </button>
        <span className={styles.hint}>or press Ctrl + Enter</span>
      </div>
      <div aria-live="polite" className={styles.consoleOutput}>
        {sql.status === "loading" ? <p className={styles.hint}>Starting SQLite…</p> : null}
        {sql.status === "error" ? (
          <p className={styles.errorText}>The SQL engine could not start ({sql.message}).</p>
        ) : null}
        {outcome?.kind === "error" ? <p className={styles.errorText}>{outcome.message}</p> : null}
        {outcome?.kind === "ok" ? (
          <>
            <p className={styles.hint}>
              {outcome.result.rows.length}
              {outcome.result.truncated ? "+" : ""}{" "}
              {outcome.result.rows.length === 1 ? "row" : "rows"} in {outcome.result.ms.toFixed(1)}{" "}
              ms
              {outcome.result.truncated ? ", showing the first 200" : ""}.
            </p>
            <ResultTable
              columns={outcome.result.columns}
              rows={outcome.result.rows}
              caption="Query result"
              maxHeight={360}
              renderCell={(column, value) =>
                column === "lead_id" && typeof value === "string" ? (
                  <button type="button" className={styles.leadLink} onClick={() => onOpen(value)}>
                    {value}
                  </button>
                ) : value === null || value === undefined ? (
                  <span className={styles.null}>NULL</span>
                ) : typeof value === "number" && !Number.isInteger(value) ? (
                  value.toFixed(3)
                ) : (
                  String(value)
                )
              }
            />
          </>
        ) : null}
      </div>
      <details className={styles.schema}>
        <summary>Tables you can query</summary>
        <pre className={styles.code}>
          <code>{SCHEMA_SQL.trim()}</code>
        </pre>
      </details>
    </section>
  );
}
