import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_EFFORT,
  AGENT_MODEL,
  AgentInput,
  checkSources,
  costOf,
  Limiter,
  MAX_SEARCHES,
  Research,
  SUBMIT_TOOL_SCHEMA,
  SYSTEM_PROMPT,
  userPrompt,
} from "@/core/agent/contract";

/**
 * The live research agent. One POST runs one research: web search, a brief with sources, a fit
 * score and a draft message. Nothing is ever sent from here; the page shows the draft to the
 * visitor, who approves or rejects it.
 *
 * Abuse and cost controls, from first to last line of defense: same-origin requests only, a
 * per-visitor and a per-instance daily limit kept in memory, at most three searches and a small
 * output budget per run, and the spend limit set on the API workspace in the Claude Console.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const perVisitor = new Limiter(3, 60 * 60 * 1000);
const daily = new Limiter(Number(process.env.AGENT_DAILY_LIMIT ?? 40), 24 * 60 * 60 * 1000);
const MAX_CONTINUATIONS = 3;

type Failure = "offline" | "forbidden" | "invalid" | "rate_limited" | "busy" | "failed";

function fail(error: Failure, status: number, message: string) {
  return Response.json({ ok: false, error, message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.AGENT_ENABLED === "false") {
    return fail("offline", 503, "The live agent is switched off right now.");
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return fail("forbidden", 403, "Requests must come from this site.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid", 400, "Send a company name and what you sell.");
  }
  const parsed = AgentInput.safeParse(body);
  if (!parsed.success) {
    return fail(
      "invalid",
      400,
      "Use a company name of 2 to 80 characters and an offer of 10 to 240 characters.",
    );
  }

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!perVisitor.take(visitor)) {
    return fail("rate_limited", 429, "Three runs an hour per visitor. Try again later.");
  }
  if (!daily.take("all")) {
    return fail("busy", 429, "Today's runs are used up. The simulator above still works.");
  }

  const client = new Anthropic({ maxRetries: 1, timeout: 55_000 });
  const started = Date.now();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: userPrompt(parsed.data) },
  ];
  const searched: { url: string; title: string }[] = [];
  const usage = { input_tokens: 0, output_tokens: 0, web_search_requests: 0 };
  let modelUsed: string = AGENT_MODEL;

  try {
    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      const response = await client.beta.messages.create({
        model: AGENT_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: AGENT_EFFORT },
        system: SYSTEM_PROMPT,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
          {
            name: "submit_research",
            description:
              "Submit the finished research, fit score and draft message. Call it once, at the end.",
            input_schema: SUBMIT_TOOL_SCHEMA as unknown as Anthropic.Beta.BetaTool.InputSchema,
            strict: true,
          },
        ],
        messages,
      });
      modelUsed = response.model;
      usage.input_tokens += response.usage.input_tokens;
      usage.output_tokens += response.usage.output_tokens;
      usage.web_search_requests += response.usage.server_tool_use?.web_search_requests ?? 0;

      for (const block of response.content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const result of block.content) {
            searched.push({ url: result.url, title: result.title });
          }
        }
      }

      if (response.stop_reason === "refusal") {
        return fail("failed", 422, "The model declined this request. Try another company.");
      }
      const submit = response.content.find(
        (block): block is Anthropic.Beta.BetaToolUseBlock =>
          block.type === "tool_use" && block.name === "submit_research",
      );
      if (submit) {
        const research = Research.safeParse(submit.input);
        if (!research.success) {
          return fail("failed", 502, "The research came back in an unexpected shape.");
        }
        const checked = checkSources(
          research.data,
          searched.map((result) => result.url),
        );
        return Response.json({
          ok: true,
          ...checked,
          searches: searched.slice(0, 12),
          usage: {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            searches: usage.web_search_requests,
          },
          costUsd: costOf({
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            server_tool_use: { web_search_requests: usage.web_search_requests },
          }),
          seconds: Math.round((Date.now() - started) / 100) / 10,
          model: modelUsed,
        });
      }
      if (response.stop_reason !== "pause_turn") break;
      // A long server-side search turn paused; send it back so the server continues it.
      messages.push({ role: "assistant", content: response.content });
    }
    return fail("failed", 502, "The agent finished without submitting its research.");
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return fail("busy", 429, "The AI service is busy. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      return fail("failed", 502, "The AI service returned an error.");
    }
    return fail("failed", 500, "Something went wrong while researching.");
  }
}
