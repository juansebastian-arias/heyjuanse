/**
 * Runs the inbound lead agent on the four sample leads and stores the results in
 * content/agent/recordings.json, so the site can replay real runs without calling the API.
 * Meant to run in GitHub Actions with the ANTHROPIC_API_KEY secret; about 10 US cents in total.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SAMPLE_LEADS } from "../content/agent/leads";
import type { Recordings } from "../content/agent/recordings";
import { runTriage } from "../server/agent/triage";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Run this in GitHub Actions, or export the key.");
    process.exit(1);
  }
  const client = new Anthropic({ maxRetries: 3, timeout: 60_000 });
  const runs: Recordings["runs"] = {};
  let total = 0;
  for (const lead of SAMPLE_LEADS) {
    const run = await runTriage(client, lead);
    runs[lead.id] = run;
    total += run.costUsd;
    console.log(
      `${lead.id}: ${run.triage.intent} -> ${run.triage.route.owner}, fit ${run.triage.fit.score}, ${run.seconds}s, $${run.costUsd.toFixed(4)}`,
    );
  }
  const file: Recordings = { recordedAt: new Date().toISOString(), runs };
  writeFileSync(
    join(process.cwd(), "content", "agent", "recordings.json"),
    `${JSON.stringify(file, null, 2)}\n`,
  );
  console.log(`Total: $${total.toFixed(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
