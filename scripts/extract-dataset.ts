/**
 * Runs the AI extraction over every message in one or more weeks and stores the answers in
 * public/data/<week>/ai.json. Meant to run in GitHub Actions with the ANTHROPIC_API_KEY secret.
 *
 *   pnpm ai:extract                     all weeks
 *   pnpm ai:extract --week 2026-w41     one week
 *   pnpm ai:extract --limit 5           a few messages per week, as a smoke test (not saved)
 *   pnpm ai:extract --dry-run           count messages and estimate cost, no API calls
 *
 * Environment: AI_MODEL (default claude-haiku-5-5), AI_EFFORT (default low),
 * AI_MAX_COST_USD (default 3), AI_CONCURRENCY (default 4).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { PROMPT_VERSION } from "../core/ai/prompt";
import type { AiRunFile, StoredExtraction } from "../core/ai/schema";
import { formatDataFile, type LeadsFile, type Manifest } from "../core/data/files";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  type Effort,
  estimateCost,
  extractMessage,
  FatalExtractionError,
} from "../server/ai/extract";
import { DATA_DIR, sha256, writeManifest } from "./generate-datasets";

interface Args {
  weeks: string[] | null;
  limit: number | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { weeks: null, limit: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--week") args.weeks = [...(args.weeks ?? []), argv[++i] ?? ""];
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function runPool<T, R>(
  items: T[],
  size: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;
  const effort = (process.env.AI_EFFORT ?? DEFAULT_EFFORT) as Effort;
  const maxCost = Number(process.env.AI_MAX_COST_USD ?? 3);
  const concurrency = Number(process.env.AI_CONCURRENCY ?? 4);
  const manifest = JSON.parse(readFileSync(join(DATA_DIR, "manifest.json"), "utf8")) as Manifest;
  const weeks = manifest.weeks.filter((week) => !args.weeks || args.weeks.includes(week.id));
  if (weeks.length === 0) throw new Error("No matching weeks in public/data/manifest.json");

  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Run this in GitHub Actions, or export the key locally.",
    );
    process.exit(1);
  }
  const client = new Anthropic({ maxRetries: 4, timeout: 60_000 });
  let spent = 0;

  for (const week of weeks) {
    const leadsText = readFileSync(join(DATA_DIR, week.files.leads), "utf8");
    const leads = JSON.parse(leadsText) as LeadsFile;
    let inputs = leads.rawLeads
      .filter((lead) => lead.message !== null)
      .map((lead) => ({
        rawId: lead.rawId,
        receivedAt: lead.receivedAt,
        source: lead.source,
        message: lead.message as string,
      }));
    if (args.limit !== null) inputs = inputs.slice(0, args.limit);
    console.info(`${week.id}: ${inputs.length} messages`);
    if (args.dryRun) {
      const roughCost = estimateCost(model, inputs.length * 1800, inputs.length * 900);
      console.info(`  dry run: roughly $${roughCost.toFixed(2)} with ${model}`);
      continue;
    }

    let done = 0;
    const results = await runPool(inputs, concurrency, async (input): Promise<StoredExtraction> => {
      if (spent >= maxCost) {
        return {
          rawId: input.rawId,
          status: "api_error",
          output: null,
          error: "Skipped: cost cap reached",
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }
      const result = await extractMessage(client, input, { model, effort, maxTokens: 4000 });
      spent += estimateCost(model, result.usage.inputTokens, result.usage.outputTokens);
      done++;
      if (done % 25 === 0)
        console.info(`  ${done}/${inputs.length} done, about $${spent.toFixed(3)} so far`);
      return result;
    });

    const inputTokens = results.reduce((sum, r) => sum + r.usage.inputTokens, 0);
    const outputTokens = results.reduce((sum, r) => sum + r.usage.outputTokens, 0);
    const failures = results.filter((r) => r.status !== "ok");
    console.info(`  finished: ${results.length - failures.length} ok, ${failures.length} not ok`);
    for (const failure of failures)
      console.info(`    ${failure.rawId}: ${failure.status} ${failure.error ?? ""}`);

    if (args.limit !== null) {
      console.info("  --limit was set, so nothing was saved.");
      continue;
    }
    const run: AiRunFile = {
      weekId: week.id,
      model,
      effort,
      promptVersion: PROMPT_VERSION,
      generatorVersion: manifest.generatorVersion,
      leadsSha256: sha256(leadsText),
      generatedAt: new Date().toISOString(),
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: Number(estimateCost(model, inputTokens, outputTokens).toFixed(4)),
      },
      results,
    };
    const target = join(DATA_DIR, week.id, "ai.json");
    writeFileSync(target, formatDataFile(run));
    console.info(`  wrote public/data/${week.id}/ai.json`);
  }
  if (args.dryRun) return;
  if (args.limit === null) writeManifest();
  console.info(`Total estimated cost: $${spent.toFixed(3)}`);
}

main().catch((error: unknown) => {
  if (error instanceof FatalExtractionError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
});
