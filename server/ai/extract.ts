/**
 * Calls the Claude API to extract signals from one message. Runs only in scripts and CI, never
 * in the browser, so the API key stays server-side.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DEFAULT_EFFORT, DEFAULT_MODEL, type Effort, estimateCost } from "../../core/ai/config";
import { buildUserMessage, SYSTEM_PROMPT } from "../../core/ai/prompt";
import { ExtractionSchema, type StoredExtraction } from "../../core/ai/schema";
import type { LeadSource } from "../../core/model";

export { PRICING } from "../../core/ai/config";
export { DEFAULT_EFFORT, DEFAULT_MODEL, type Effort, estimateCost };

export interface ExtractInput {
  rawId: string;
  receivedAt: string;
  source: LeadSource;
  message: string;
}

export interface ExtractOptions {
  model: string;
  effort: Effort;
  maxTokens: number;
}

/** The part of the SDK client this module uses, so tests can pass a fake. */
export interface MessagesClient {
  messages: Pick<Anthropic["messages"], "parse">;
}

/** Errors that mean the whole run should stop, not just this message. */
export class FatalExtractionError extends Error {}

export async function extractMessage(
  client: MessagesClient,
  input: ExtractInput,
  options: ExtractOptions,
): Promise<StoredExtraction> {
  const empty = { inputTokens: 0, outputTokens: 0 };
  try {
    const response = await client.messages.parse({
      model: options.model,
      max_tokens: options.maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
      output_config: { format: zodOutputFormat(ExtractionSchema), effort: options.effort },
    });
    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    if (response.stop_reason === "refusal") {
      return {
        rawId: input.rawId,
        status: "refusal",
        output: null,
        error: "The model declined",
        usage,
      };
    }
    if (response.stop_reason === "max_tokens") {
      return {
        rawId: input.rawId,
        status: "max_tokens",
        output: null,
        error: `Stopped at max_tokens (${options.maxTokens})`,
        usage,
      };
    }
    const checked = ExtractionSchema.safeParse(response.parsed_output);
    if (!checked.success) {
      return {
        rawId: input.rawId,
        status: "invalid_output",
        output: null,
        error: checked.error.issues[0]?.message ?? "Output did not match the schema",
        usage,
      };
    }
    return { rawId: input.rawId, status: "ok", output: checked.data, usage };
  } catch (error) {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError
    ) {
      throw new FatalExtractionError(
        "The API key was rejected. Check the ANTHROPIC_API_KEY secret.",
      );
    }
    if (error instanceof Anthropic.NotFoundError) {
      throw new FatalExtractionError(`Model ${options.model} was not found.`);
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new FatalExtractionError(`The API rejected the request: ${error.message}`);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return {
        rawId: input.rawId,
        status: "api_error",
        output: null,
        error: "Rate limited after retries",
        usage: empty,
      };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return {
        rawId: input.rawId,
        status: "api_error",
        output: null,
        error: "Connection failed after retries",
        usage: empty,
      };
    }
    if (error instanceof Anthropic.APIError) {
      return {
        rawId: input.rawId,
        status: "api_error",
        output: null,
        error: `API error ${error.status ?? ""}`.trim(),
        usage: empty,
      };
    }
    if (error instanceof Anthropic.AnthropicError) {
      // The SDK could not parse the structured output.
      return {
        rawId: input.rawId,
        status: "invalid_output",
        output: null,
        error: error.message,
        usage: empty,
      };
    }
    throw error;
  }
}
