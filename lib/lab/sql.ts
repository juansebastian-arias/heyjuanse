"use client";

/**
 * SQLite in the browser (sql.js). Loaded only on the lab page, after the first render.
 */
import { startTransition, useEffect, useRef, useState } from "react";
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

const WASM_URL = "/vendor/sql-wasm-browser.wasm";

/**
 * Downloads the engine here rather than inside sql.js, so a failed download becomes a short,
 * readable error instead of an abort in the WebAssembly loader.
 */
async function downloadEngine(): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(WASM_URL);
  } catch {
    throw new Error("its file did not download");
  }
  if (!response.ok) throw new Error(`its file did not download: HTTP ${response.status}`);
  return response.arrayBuffer();
}

export function loadSqlEngine(): Promise<SqlJsStatic> {
  enginePromise ??= Promise.all([import("sql.js"), downloadEngine()]).then(([module, wasmBinary]) =>
    module.default({ wasmBinary }),
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
        const version = versionRef.current;
        const queryMs = performance.now() - started;
        startTransition(() =>
          setState({ status: "ready", db, metrics, forDecisions: decisions, version, queryMs }),
        );
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

export interface ConsoleResult {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  /** More rows existed than were read. */
  truncated: boolean;
  ms: number;
}

const COMMENTS_AND_SPACE = /^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/;

/**
 * Runs one read-only statement typed by a visitor, against the lab's own database. Three
 * guards: only SELECT, WITH or EXPLAIN may start it, only one statement may run, and SQLite's
 * query_only switch refuses any write that gets past the first two.
 */
export function runReadOnly(db: SqlDatabase, sql: string, maxRows = 200): ConsoleResult {
  const source = sql.replace(COMMENTS_AND_SPACE, "");
  if (source === "") throw new Error("Type a query to run.");
  if (!/^(select|with|explain)\b/i.test(source)) {
    throw new Error("Only SELECT queries can run here. The lab's tables are read-only.");
  }
  const database = db as unknown as Database;
  const started = performance.now();
  database.run("PRAGMA query_only = 1");
  let statement: ReturnType<Database["prepare"]> | null = null;
  try {
    statement = database.prepare(source);
    const compiled = statement.getSQL();
    const at = source.indexOf(compiled);
    const rest = at >= 0 ? source.slice(at + compiled.length).replace(COMMENTS_AND_SPACE, "") : "";
    if (rest !== "") throw new Error("Run one statement at a time.");
    const rows: ConsoleResult["rows"] = [];
    let truncated = false;
    while (statement.step()) {
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push(
        statement
          .get()
          .map((value) =>
            value instanceof Uint8Array
              ? `<${value.length} bytes>`
              : (value as string | number | null),
          ),
      );
    }
    return {
      columns: statement.getColumnNames(),
      rows,
      truncated,
      ms: performance.now() - started,
    };
  } finally {
    statement?.free();
    database.run("PRAGMA query_only = 0");
  }
}
