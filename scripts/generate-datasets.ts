/**
 * Writes the synthetic weeks to public/data. Run with `pnpm data:generate`.
 * A test regenerates the files and fails if the committed copies are out of date.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatDataFile, type Manifest, splitDataset } from "../core/data/files";
import { GENERATOR_VERSION, generateCompanies, generateWeek } from "../core/dataset/generate";
import { WEEKS } from "../core/dataset/weeks";

export const DATA_DIR = join(process.cwd(), "public", "data");

export function buildDataFiles(): Map<string, string> {
  const files = new Map<string, string>();
  const companies = generateCompanies();
  const manifest: Manifest = { generatorVersion: GENERATOR_VERSION, weeks: [] };
  for (const week of WEEKS) {
    const { leads, labels } = splitDataset(generateWeek(week, companies));
    const leadsText = formatDataFile(leads);
    const labelsText = formatDataFile(labels);
    const leadsPath = `${week.id}/leads.json`;
    const labelsPath = `${week.id}/labels.json`;
    const aiPath = `${week.id}/ai.json`;
    files.set(leadsPath, leadsText);
    files.set(labelsPath, labelsText);
    manifest.weeks.push({
      id: week.id,
      label: week.label,
      weekStart: week.start,
      weekEnd: week.end,
      rawLeadCount: leads.rawLeads.length,
      files: {
        leads: leadsPath,
        labels: labelsPath,
        ai: existsSync(join(DATA_DIR, aiPath)) ? aiPath : null,
      },
      sha256: { leads: sha256(leadsText), labels: sha256(labelsText) },
    });
  }
  files.set("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  return files;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function main(): void {
  for (const [path, text] of buildDataFiles()) {
    const target = join(DATA_DIR, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, text);
    console.info(`wrote public/data/${path} (${(text.length / 1024).toFixed(1)} KB)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
