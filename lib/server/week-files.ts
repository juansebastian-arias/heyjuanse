/**
 * Reads the published data files at build time, for pages that are rendered on the server. The
 * browser reads the same files over HTTP.
 */
import { createHash } from "node:crypto";
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

/**
 * The stored AI run for a week, only if it was made for the leads file published now. The lab
 * applies the same check in the browser and ignores a run made for other leads.
 */
export function readCurrentAiRun(weekId: string): AiRunFile | null {
  const week = readManifest().weeks.find((candidate) => candidate.id === weekId);
  const run = readAiRun(weekId);
  if (!week || !run) return null;
  const leadsText = readFileSync(join(DATA_DIR, week.files.leads), "utf8");
  const leadsSha256 = createHash("sha256").update(leadsText).digest("hex");
  return run.leadsSha256 === leadsSha256 ? run : null;
}
