/**
 * Which model reads the messages, at what effort, and what it costs. Shared by the extraction
 * script and the site, so the page and the run cannot disagree.
 */
export const DEFAULT_MODEL = "claude-haiku-5-5";
export const DEFAULT_EFFORT = "low" as const;
export type Effort = "low" | "medium" | "high";

/** The extraction script stops calling the model once a run's estimated cost reaches this. */
export const DEFAULT_MAX_COST_USD = 3;

/** US dollars per million tokens, for prompts of 100K tokens or fewer. */
export const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 3, output: 15 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model];
  if (!price) return Number.NaN;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
