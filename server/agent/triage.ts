/**
 * One run of the inbound lead agent: a single Claude call that must end in the submit_lead tool.
 * Used by the live API route and by the script that records the sample runs, so both behave the
 * same way.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_EFFORT,
  AGENT_MODEL,
  costOf,
  type LeadForPrompt,
  SUBMIT_TOOL_SCHEMA,
  SYSTEM_PROMPT,
  Triage,
  userPrompt,
} from "../../core/agent/contract";

export interface TriageRun {
  triage: Triage;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  seconds: number;
  model: string;
}

export class TriageError extends Error {
  constructor(
    readonly kind: "refused" | "shape" | "no_submit",
    message: string,
  ) {
    super(message);
  }
}

export async function runTriage(client: Anthropic, lead: LeadForPrompt): Promise<TriageRun> {
  const started = Date.now();
  const response = await client.beta.messages.create({
    model: AGENT_MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: AGENT_EFFORT },
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_lead",
        description: "Submit the triage, routing, reply draft and CRM note. Call it once.",
        input_schema: SUBMIT_TOOL_SCHEMA as unknown as Anthropic.Beta.BetaTool.InputSchema,
        strict: true,
      },
    ],
    messages: [{ role: "user", content: userPrompt(lead) }],
  });
  if (response.stop_reason === "refusal") {
    throw new TriageError("refused", "The model declined this lead.");
  }
  const submit = response.content.find(
    (block): block is Anthropic.Beta.BetaToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_lead",
  );
  if (!submit) throw new TriageError("no_submit", "The agent finished without a result.");
  const parsed = Triage.safeParse(submit.input);
  if (!parsed.success)
    throw new TriageError("shape", "The result came back in an unexpected shape.");
  return {
    triage: parsed.data,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    costUsd: costOf(response.usage),
    seconds: Math.round((Date.now() - started) / 100) / 10,
    model: response.model,
  };
}
