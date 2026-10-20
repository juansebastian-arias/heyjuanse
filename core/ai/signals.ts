/**
 * What the rules may use from AI: a handful of enum fields per lead, plus a confidence level.
 * Free text never reaches the rules. The worst a misleading message can do is move these
 * values, and their effect on the score is capped.
 */
import type { Budget, Confidence, Intent, Language, NextStep, PainPoint, Timeline } from "../model";

export interface AiSignals {
  intent: Intent;
  timeline: Timeline;
  budget: Budget;
  nextStep: NextStep;
  painPoints: PainPoint[];
  language: Language;
  /** The message tried to instruct an automated reader. */
  injection: boolean;
  confidence: Confidence;
}

/** AI signals for one lead, combined from the extraction of each of its messages. */
export interface LeadAiSignals extends AiSignals {
  /** The messages the signals came from, in arrival order. */
  rawIds: string[];
}

export type AiPolicy = "off" | "high" | "high_medium";

export const AI_POLICY_LABELS: Record<AiPolicy, string> = {
  off: "Off",
  high: "High confidence only",
  high_medium: "High and medium confidence",
};

export function isTrusted(confidence: Confidence, policy: AiPolicy): boolean {
  if (policy === "off") return false;
  if (policy === "high") return confidence === "high";
  return confidence === "high" || confidence === "medium";
}

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Combine per-message signals into one set per lead. For each field, the most recent message
 * that states something wins ("unclear" intent counts as not stating anything). Pain points are
 * the union. An injection attempt in any message flags the lead. The lead's confidence is the
 * lowest confidence among the messages that contributed.
 */
export function combineSignals(
  messages: Array<{ rawId: string; signals: AiSignals }>,
): LeadAiSignals | null {
  if (messages.length === 0) return null;
  const pick = <T>(
    get: (signals: AiSignals) => T,
    isStated: (value: T) => boolean,
    fallback: T,
  ): { value: T; rawId: string | null } => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message) continue;
      const value = get(message.signals);
      if (isStated(value)) return { value, rawId: message.rawId };
    }
    return { value: fallback, rawId: null };
  };
  const intent = pick(
    (s) => s.intent,
    (v) => v !== "unclear",
    "unclear" as Intent,
  );
  const timeline = pick(
    (s) => s.timeline,
    (v) => v !== "not_stated",
    "not_stated" as Timeline,
  );
  const budget = pick(
    (s) => s.budget,
    (v) => v !== "not_mentioned",
    "not_mentioned" as Budget,
  );
  const nextStep = pick(
    (s) => s.nextStep,
    (v) => v !== "none",
    "none" as NextStep,
  );
  const latest = messages[messages.length - 1];
  const language = latest ? latest.signals.language : "other";
  const contributing = new Set(
    [intent.rawId, timeline.rawId, budget.rawId, nextStep.rawId].filter(
      (id): id is string => id !== null,
    ),
  );
  if (contributing.size === 0 && latest) contributing.add(latest.rawId);
  let confidence: Confidence = "high";
  for (const message of messages) {
    if (!contributing.has(message.rawId)) continue;
    if (CONFIDENCE_RANK[message.signals.confidence] < CONFIDENCE_RANK[confidence]) {
      confidence = message.signals.confidence;
    }
  }
  const painPoints = [...new Set(messages.flatMap((m) => m.signals.painPoints))].sort();
  return {
    intent: intent.value,
    timeline: timeline.value,
    budget: budget.value,
    nextStep: nextStep.value,
    painPoints,
    language,
    injection: messages.some((m) => m.signals.injection),
    confidence,
    rawIds: messages.map((m) => m.rawId),
  };
}
