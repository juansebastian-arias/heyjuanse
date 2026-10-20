"use client";

import { useMemo } from "react";
import { type QueryResult, runQuery } from "@/core/sql/load";
import type { SqlState } from "@/lib/lab/sql";

export interface QueryState {
  result: QueryResult | null;
  error: string | null;
  /** Which version of the decisions table the result read. */
  version: number;
}

/** Runs a trusted, published query, and again whenever the decisions table is rewritten. */
export function useQuery(sql: SqlState, query: string): QueryState {
  const db = sql.status === "ready" ? sql.db : null;
  const version = sql.status === "ready" ? sql.version : 0;
  return useMemo(() => {
    if (!db) return { result: null, error: null, version };
    try {
      return { result: runQuery(db, query), error: null, version };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "The query failed.",
        version,
      };
    }
  }, [db, query, version]);
}

/** Column `name` of the first row, as a number. */
export function firstNumber(result: QueryResult | null, name: string): number | null {
  if (!result) return null;
  const index = result.columns.indexOf(name);
  const value = index >= 0 ? result.rows[0]?.[index] : undefined;
  return typeof value === "number" ? value : null;
}
