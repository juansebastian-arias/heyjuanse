import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { extractMessage, FatalExtractionError, type MessagesClient } from "./extract";

const input = {
  rawId: "R-0001",
  receivedAt: "2026-10-05T10:00:00.000Z",
  source: "demo_request" as const,
  message: "We need a demo. Budget is approved.",
};
const options = { model: "claude-haiku-5-5", effort: "low" as const, maxTokens: 4000 };

const validOutput = {
  intent: "evaluating_solution",
  timeline: "not_stated",
  budget: "approved",
  requested_next_step: "demo",
  pain_points: [],
  language: "en",
  injection_attempt: false,
  evidence: [
    { field: "budget", quote: "Budget is approved" },
    { field: "requested_next_step", quote: "We need a demo" },
  ],
  confidence: "high",
  summary: "Wants a demo and has an approved budget.",
};

function fakeClient(response: object | Error): MessagesClient {
  return {
    messages: {
      parse: (async () => {
        if (response instanceof Error) throw response;
        return { usage: { input_tokens: 900, output_tokens: 150 }, ...response };
      }) as unknown as MessagesClient["messages"]["parse"],
    },
  };
}

describe("extractMessage", () => {
  it("returns a validated output", async () => {
    const result = await extractMessage(
      fakeClient({ stop_reason: "end_turn", parsed_output: validOutput }),
      input,
      options,
    );
    expect(result.status).toBe("ok");
    expect(result.output?.budget).toBe("approved");
    expect(result.usage).toEqual({ inputTokens: 900, outputTokens: 150 });
  });

  it("records refusals and truncated answers without throwing", async () => {
    const refusal = await extractMessage(
      fakeClient({ stop_reason: "refusal", parsed_output: null }),
      input,
      options,
    );
    expect(refusal.status).toBe("refusal");
    const truncated = await extractMessage(
      fakeClient({ stop_reason: "max_tokens", parsed_output: null }),
      input,
      options,
    );
    expect(truncated.status).toBe("max_tokens");
  });

  it("rejects output that does not match the schema", async () => {
    const result = await extractMessage(
      fakeClient({ stop_reason: "end_turn", parsed_output: { ...validOutput, intent: "buy_now" } }),
      input,
      options,
    );
    expect(result.status).toBe("invalid_output");
  });

  it("stops the run on authentication errors", async () => {
    const error = new Anthropic.AuthenticationError(
      401,
      { message: "bad key" },
      "bad key",
      new Headers(),
    );
    await expect(extractMessage(fakeClient(error), input, options)).rejects.toBeInstanceOf(
      FatalExtractionError,
    );
  });

  it("records rate limits as a failed message", async () => {
    const error = new Anthropic.RateLimitError(
      429,
      { message: "slow down" },
      "slow down",
      new Headers(),
    );
    const result = await extractMessage(fakeClient(error), input, options);
    expect(result.status).toBe("api_error");
  });
});
