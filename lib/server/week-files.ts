/**
 * Reads the published data files at build time, for pages that are rendered on the server. The
 * browser reads the same files over HTTP.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiRunFile } from "@/core/ai/schema";
import type { LabelsFile, LeadsFile, Manifest } from "@/core/data/files";

const DATA_DIR = join(process.cwd(), "public", "data");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, path), "utf8")) as T;
}

export function readManifest(): Manifest {
  return readJson<Manifest>("manifest.json");
}

export function readWeek(weekId: string): { leads: LeadsFile; labels: LabelsFile } {
  const week = readManifest().weeks.find((candidate) => candidate.id === weekId);
  if (!week) throw new Error(`Week ${weekId} is not in the manifest`);
  return {
    leads: readJson<LeadsFile>(week.files.leads),
    labels: readJson<LabelsFile>(week.files.labels),
  };
}

/** The stored AI run for a week, if one has been published. */
export function readAiRun(weekId: string): AiRunFile | null {
  const week = readManifest().weeks.find((candidate) => candidate.id === weekId);
  if (!week?.files.ai) return null;
  return readJson<AiRunFile>(week.files.ai);
}
