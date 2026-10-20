/**
 * Layout of the published data files. The split is deliberate: the engine only ever reads
 * `leads.json`. The answer key lives in `labels.json`, and only the scorecard reads it.
 */
import type { Company, Dataset, MessageTruth, PersonTruth, RawLead } from "../model";

export interface LeadsFile {
  id: string;
  label: string;
  seed: number;
  generatorVersion: number;
  weekStart: string;
  weekEnd: string;
  /** The simulated firmographic provider and CRM account list. */
  companies: Company[];
  /** Emails that asked not to be contacted, lowercase. */
  suppressions: string[];
  rawLeads: RawLead[];
}

export interface LabelsFile {
  id: string;
  generatorVersion: number;
  people: PersonTruth[];
  messages: MessageTruth[];
}

export interface ManifestWeek {
  id: string;
  label: string;
  weekStart: string;
  weekEnd: string;
  rawLeadCount: number;
  files: { leads: string; labels: string; ai: string | null };
  sha256: { leads: string; labels: string };
}

export interface Manifest {
  generatorVersion: number;
  weeks: ManifestWeek[];
}

export function splitDataset(dataset: Dataset): { leads: LeadsFile; labels: LabelsFile } {
  return {
    leads: {
      id: dataset.id,
      label: dataset.label,
      seed: dataset.seed,
      generatorVersion: dataset.generatorVersion,
      weekStart: dataset.weekStart,
      weekEnd: dataset.weekEnd,
      companies: dataset.companies,
      suppressions: dataset.suppressions,
      rawLeads: dataset.rawLeads,
    },
    labels: {
      id: dataset.id,
      generatorVersion: dataset.generatorVersion,
      people: dataset.truth.people,
      messages: dataset.truth.messages,
    },
  };
}

/**
 * JSON with one array element per line. Close to compact JSON in size, but readable in a diff
 * and easy to grep.
 */
export function formatDataFile(value: object): string {
  const lines: string[] = ["{"];
  const entries = Object.entries(value);
  entries.forEach(([key, item], index) => {
    const comma = index < entries.length - 1 ? "," : "";
    if (Array.isArray(item) && item.length > 0) {
      lines.push(`  ${JSON.stringify(key)}: [`);
      item.forEach((element, i) => {
        lines.push(`    ${JSON.stringify(element)}${i < item.length - 1 ? "," : ""}`);
      });
      lines.push(`  ]${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(item)}${comma}`);
    }
  });
  lines.push("}");
  return `${lines.join("\n")}\n`;
}
