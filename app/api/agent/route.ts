import Anthropic from "@anthropic-ai/sdk";
import { AgentInput, Limiter } from "@/core/agent/contract";
import { runTriage, TriageError } from "@/server/agent/triage";

/**
 * The live inbound lead agent. One POST runs one lead: intent, urgency, fit, owner, a reply draft
 * and a CRM note. Nothing is ever sent from here; the page shows the draft to the visitor, who
 * approves or rejects it.
 *
 * Abuse and cost controls, from first to last line of defense: same-origin requests only, a
 * per-visitor and a per-instance daily limit kept in memory, one model call with a small output
 * budget per run, and the spend limit set on the API workspace in the Claude Console.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const perVisitor = new Limiter(5, 60 * 60 * 1000);
const daily = new Limiter(Number(process.env.AGENT_DAILY_LIMIT ?? 100), 24 * 60 * 60 * 1000);

type Failure = "offline" | "forbidden" | "invalid" | "rate_limited" | "busy" | "failed";

function fail(error: Failure, status: number, message: string) {
  return Response.json({ ok: false, error, message }, { status });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return fail("forbidden", 403, "Requests must come from this site.");
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.AGENT_ENABLED === "false") {
    return fail(
      "offline",
      503,
      "The live agent is switched off right now. The four sample leads above still show real recorded runs.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid", 400, "Write the lead's message.");
  }
  const parsed = AgentInput.safeParse(body);
  if (!parsed.success) {
    return fail("invalid", 400, "Write a message of 15 to 600 characters.");
  }

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!perVisitor.take(visitor)) {
    return fail("rate_limited", 429, "Five live runs an hour per visitor. Try again later.");
  }
  if (!daily.take("all")) {
    return fail("busy", 429, "Today's live runs are used up. The sample leads still work.");
  }

  try {
    const run = await runTriage(new Anthropic({ maxRetries: 1, timeout: 50_000 }), parsed.data);
    return Response.json({ ok: true, ...run });
  } catch (error) {
    if (error instanceof TriageError) {
      return fail("failed", error.kind === "refused" ? 422 : 502, error.message);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return fail("busy", 429, "The AI service is busy. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      return fail("failed", 502, "The AI service returned an error.");
    }
    return fail("failed", 500, "Something went wrong while handling the lead.");
  }
}
