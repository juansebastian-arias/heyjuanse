/**
 * Real runs of the inbound lead agent on the sample leads, recorded by scripts/record-agent.ts in
 * GitHub Actions and replayed on the page. Nothing here is written by hand.
 */
import type { Triage } from "../../core/agent/contract";
import data from "./recordings.json";

export interface RecordedRun {
  triage: Triage;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  seconds: number;
  model: string;
}

export interface Recordings {
  recordedAt: string | null;
  runs: Record<string, RecordedRun>;
}

export const RECORDINGS = data as Recordings;
