"use client";

/**
 * Loads one week of published data in the browser and prepares it for the lab. Everything the
 * page shows is computed from these files.
 */
import { startTransition, useEffect, useState } from "react";
import { type AiIndex, indexAiRun } from "@/core/ai/outputs";
import type { AiRunFile } from "@/core/ai/schema";
import type { LeadAiSignals } from "@/core/ai/signals";
import { indexLabels, type LeadLabelIndex } from "@/core/backtest/metrics";
import { answerKeySignals } from "@/core/backtest/run";
import type { CleanRecord } from "@/core/cleaning/normalize";
import { type Lead, type PreparedWeek, prepareWeek } from "@/core/cleaning/pipeline";
import type { LabelsFile, LeadsFile, Manifest, ManifestWeek } from "@/core/data/files";
import type { PersonTruth, RawLead } from "@/core/model";

export interface WeekData {
  week: ManifestWeek;
  leadsFile: LeadsFile;
  labels: LabelsFile;
  aiRun: AiRunFile | null;
  /** The stored outputs were made for a different version of the leads file. */
  aiStale: boolean;
  prepared: PreparedWeek;
  labelIndex: LeadLabelIndex;
  aiIndex: AiIndex | null;
  answerKey: Map<string, LeadAiSignals>;
  rawById: Map<string, RawLead>;
  recordById: Map<string, CleanRecord>;
  leadById: Map<string, Lead>;
  personByRaw: Map<string, PersonTruth>;
  prepareMs: number;
}

export type LabDataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; manifest: Manifest; data: WeekData };

let manifestPromise: Promise<Manifest> | null = null;
const weekCache = new Map<string, Promise<WeekData>>();

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  return (await response.json()) as T;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadWeek(week: ManifestWeek): Promise<WeekData> {
  const [leadsText, labels, aiRun] = await Promise.all([
    fetch(`/data/${week.files.leads}`).then((response) => {
      if (!response.ok) throw new Error(`Could not load the leads for ${week.label}`);
      return response.text();
    }),
    fetchJson<LabelsFile>(`/data/${week.files.labels}`),
    week.files.ai
      ? fetchJson<AiRunFile>(`/data/${week.files.ai}`).catch(() => null)
      : Promise.resolve(null),
  ]);
  const leadsFile = JSON.parse(leadsText) as LeadsFile;
  const started = performance.now();
  const prepared = prepareWeek(leadsFile);
  const prepareMs = performance.now() - started;
  const aiStale = aiRun ? aiRun.leadsSha256 !== (await sha256Hex(leadsText)) : false;
  const personByRaw = new Map<string, PersonTruth>();
  for (const person of labels.people)
    for (const rawId of person.rawIds) personByRaw.set(rawId, person);
  return {
    week,
    leadsFile,
    labels,
    aiRun,
    aiStale,
    prepared,
    labelIndex: indexLabels(labels, prepared.leads),
    aiIndex: aiRun && !aiStale ? indexAiRun(aiRun, prepared.leads) : null,
    answerKey: answerKeySignals(prepared, labels),
    rawById: new Map(leadsFile.rawLeads.map((raw) => [raw.rawId, raw])),
    recordById: new Map(prepared.records.map((record) => [record.rawId, record])),
    leadById: new Map(prepared.leads.map((lead) => [lead.leadId, lead])),
    personByRaw,
    prepareMs,
  };
}

/** Loads a week. Pass null to wait, for example until the page has read its address. */
export function useLabData(weekId: string | null): LabDataState {
  const [state, setState] = useState<LabDataState>({ status: "loading" });
  useEffect(() => {
    if (weekId === null) return;
    let cancelled = false;
    setState((current) =>
      current.status === "ready" && current.data.week.id === weekId
        ? current
        : { status: "loading" },
    );
    manifestPromise ??= fetchJson<Manifest>("/data/manifest.json");
    manifestPromise
      .then(async (manifest) => {
        const week =
          manifest.weeks.find((candidate) => candidate.id === weekId) ?? manifest.weeks.at(-1);
        if (!week) throw new Error("The data manifest lists no weeks.");
        let promise = weekCache.get(week.id);
        if (!promise) {
          promise = loadWeek(week);
          weekCache.set(week.id, promise);
          promise.catch(() => weekCache.delete(week.id));
        }
        const data = await promise;
        // Rendering the whole lab is the heaviest step of the first load. As a transition, React
        // can pause it to handle input instead of blocking the page until it finishes.
        if (!cancelled) startTransition(() => setState({ status: "ready", manifest, data }));
      })
      .catch((error: unknown) => {
        manifestPromise = null;
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Could not load the data.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [weekId]);
  return state;
}
