"use client";

/**
 * SQLite in the browser (sql.js). Loaded only on the lab page, after the first render.
 */
import { useEffect, useRef, useState } from "react";
import type { Database, SqlJsStatic } from "sql.js";
import type { Decision } from "@/core/routing/route";
import {
  loadWeek as loadWeekIntoDb,
  runMetrics,
  type SqlDatabase,
  type SqlMetrics,
  writeDecisions,
} from "@/core/sql/load";
import type { WeekData } from "./data";

let enginePromise: Promise<SqlJsStatic> | null = null;

export function loadSqlEngine(): Promise<SqlJsStatic> {
  enginePromise ??= import("sql.js").then((module) =>
    module.default({ locateFile: () => "/vendor/sql-wasm-browser.wasm" }),
  );
  enginePromise.catch(() => {
    enginePromise = null;
  });
  return enginePromise;
}

export type SqlState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      db: SqlDatabase;
      metrics: SqlMetrics;
      /** The decisions these metrics were computed from. */
      forDecisions: Decision[];
      version: number;
      queryMs: number;
    };

/**
 * Keeps one database per week, rewrites the decisions table whenever the decisions change, and
 * re-runs the published metric queries.
 */
export function useSqlMetrics(data: WeekData | null, decisions: Decision[] | null): SqlState {
  const [state, setState] = useState<SqlState>({ status: "loading" });
  const dbRef = useRef<{ weekId: string; db: Database } | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    if (!data || !decisions) return;
    let cancelled = false;
    loadSqlEngine()
      .then((SQL) => {
        if (cancelled) return;
        if (!dbRef.current || dbRef.current.weekId !== data.week.id) {
          dbRef.current?.db.close();
          const db = new SQL.Database();
          loadWeekIntoDb(db as unknown as SqlDatabase, data.prepared, data.labels);
          dbRef.current = { weekId: data.week.id, db };
        }
        const db = dbRef.current.db as unknown as SqlDatabase;
        const started = performance.now();
        writeDecisions(db, decisions);
        const metrics = runMetrics(db);
        versionRef.current += 1;
        setState({
          status: "ready",
          db,
          metrics,
          forDecisions: decisions,
          version: versionRef.current,
          queryMs: performance.now() - started,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "The SQL engine could not start.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data, decisions]);

  useEffect(
    () => () => {
      dbRef.current?.db.close();
      dbRef.current = null;
    },
    [],
  );

  return state;
}
