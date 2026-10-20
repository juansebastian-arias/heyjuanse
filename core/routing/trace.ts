/**
 * The step-by-step path one lead took through the rules, for the case file. Built from the same
 * rule tables the router uses, and a test checks that it always ends in the router's lane.
 */
import { AI_POLICY_LABELS, isTrusted, type LeadAiSignals } from "../ai/signals";
import type { Lead } from "../cleaning/pipeline";
import { INTENT_LABELS } from "../model";
import { scoreLead } from "../scoring/score";
import {
  AI_INTENT_RULES,
  DATA_RULES,
  type Decision,
  LANE_LABELS,
  type Lane,
  QUEUE_ORDER_LABELS,
  REASONS,
  type RoutingSettings,
} from "./route";

export type StepOutcome = "pass" | "stop" | "skip" | "info";

export interface TraceStep {
  title: string;
  detail: string;
  outcome: StepOutcome;
  /** The lane this step sends the lead to, when it decides. */
  lane?: Lane;
}

export function traceDecision(
  lead: Lead,
  ai: LeadAiSignals | null,
  settings: RoutingSettings,
  decision: Decision,
  salesQueueLength: number,
): TraceStep[] {
  const steps: TraceStep[] = [];
  for (const rule of DATA_RULES) {
    if (rule.fails(lead)) {
      steps.push({
        title: rule.check,
        detail: REASONS[rule.code],
        outcome: "stop",
        lane: rule.lane,
      });
      return steps;
    }
    steps.push({ title: rule.check, detail: "Passed", outcome: "pass" });
  }

  let trusted: LeadAiSignals | null = null;
  if (settings.aiPolicy === "off") {
    steps.push({
      title: "AI signals",
      detail: "Off. The decision uses data and activity only.",
      outcome: "skip",
    });
  } else if (!ai) {
    steps.push({
      title: "AI signals",
      detail:
        lead.messages.length === 0
          ? "No message to read."
          : "No usable AI output for this lead's messages.",
      outcome: "skip",
    });
  } else if (ai.injection) {
    steps.push({
      title: "AI signals",
      detail: REASONS.INJECTION,
      outcome: "stop",
      lane: "review",
    });
    return steps;
  } else if (isTrusted(ai.confidence, settings.aiPolicy)) {
    trusted = ai;
    steps.push({
      title: "AI signals",
      detail: `Trusted: confidence ${ai.confidence}, and the policy is "${AI_POLICY_LABELS[settings.aiPolicy].toLowerCase()}".`,
      outcome: "pass",
    });
  } else {
    const withAi = decision.lane === "review";
    steps.push({
      title: "AI signals",
      detail: withAi
        ? `Confidence ${ai.confidence} is below the policy, and the signal would change the lane from ${LANE_LABELS[decision.laneWithoutAi]}. A person decides.`
        : `Confidence ${ai.confidence} is below the policy. Ignored, because it would not change the lane.`,
      outcome: withAi ? "stop" : "skip",
      lane: withAi ? "review" : undefined,
    });
    if (withAi) return steps;
  }

  const intentRule = trusted ? AI_INTENT_RULES[trusted.intent] : undefined;
  if (trusted && intentRule) {
    steps.push({
      title: "Message intent",
      detail: `AI read the message as "${INTENT_LABELS[trusted.intent].toLowerCase()}".`,
      outcome: "stop",
      lane: intentRule.lane,
    });
    return steps;
  }

  const score = scoreLead(lead, trusted, settings.weights);
  if (score.total < settings.threshold) {
    steps.push({
      title: "Score against the threshold",
      detail: `${score.total} is below the threshold of ${settings.threshold}.`,
      outcome: "stop",
      lane: "nurture",
    });
    return steps;
  }
  steps.push({
    title: "Score against the threshold",
    detail: `${score.total} is at or above the threshold of ${settings.threshold}.`,
    outcome: "pass",
    lane: "sales",
  });
  steps.push({
    title: "Sales queue",
    detail: `Position ${decision.queuePosition} of ${salesQueueLength} (${QUEUE_ORDER_LABELS[settings.queueOrder].toLowerCase()}). Capacity is ${settings.capacity} calls, so this lead ${decision.called ? "gets a call this week" : "waits until next week"}.`,
    outcome: decision.called ? "pass" : "info",
    lane: "sales",
  });
  return steps;
}

export function finalLane(steps: TraceStep[]): Lane | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const lane = steps[i]?.lane;
    if (lane) return lane;
  }
  return null;
}
