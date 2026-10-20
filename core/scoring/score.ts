/**
 * Scoring: turn a lead (and, when allowed, its AI signals) into points with a reason for each.
 */
import type { AiSignals } from "../ai/signals";
import type { Lead } from "../cleaning/pipeline";
import {
  INDUSTRY_LABELS,
  type LeadSource,
  REGION_LABELS,
  SIZE_LABELS,
  SOURCE_LABELS,
} from "../model";
import { AI_POINTS, FIT_POINTS, GROUP_LIMITS, INTENT_POINTS } from "./rules";

export type ScoreGroup = "fit" | "intent" | "ai";

export interface ScoreLine {
  group: ScoreGroup;
  label: string;
  points: number;
}

export interface GroupWeights {
  fit: number;
  intent: number;
  ai: number;
}

export const DEFAULT_WEIGHTS: GroupWeights = { fit: 1, intent: 1, ai: 1 };

export interface ScoreResult {
  total: number;
  groups: Record<ScoreGroup, number>;
  lines: ScoreLine[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function bestSource(sources: LeadSource[]): LeadSource {
  let best: LeadSource | null = null;
  for (const source of sources) {
    if (best === null || INTENT_POINTS.source[source] > INTENT_POINTS.source[best]) best = source;
  }
  if (best === null) throw new Error("A lead has at least one source");
  return best;
}

export function fitLines(lead: Lead): ScoreLine[] {
  const company = lead.match?.company ?? null;
  const industry = company?.industry ?? "unknown";
  const size = company?.sizeBand ?? "unknown";
  const region = lead.region ?? "unknown";
  return [
    {
      group: "fit",
      label:
        industry === "unknown"
          ? "Industry unknown"
          : `Industry: ${INDUSTRY_LABELS[industry].toLowerCase()}`,
      points: FIT_POINTS.industry[industry],
    },
    {
      group: "fit",
      label: size === "unknown" ? "Company size unknown" : `Company size: ${SIZE_LABELS[size]}`,
      points: FIT_POINTS.size[size],
    },
    {
      group: "fit",
      label: region === "unknown" ? "Region unknown" : `Region: ${REGION_LABELS[region]}`,
      points: FIT_POINTS.region[region],
    },
  ];
}

export function intentLines(lead: Lead): ScoreLine[] {
  const lines: ScoreLine[] = [];
  const source = bestSource(lead.sources);
  lines.push({
    group: "intent",
    label: `Source: ${SOURCE_LABELS[source].toLowerCase()}`,
    points: INTENT_POINTS.source[source],
  });
  const b = INTENT_POINTS.behavior;
  const activity = lead.activity;
  const behavior: ScoreLine[] = [];
  if (activity.pricingPageViews >= 2) {
    behavior.push({
      group: "intent",
      label: `Viewed pricing ${activity.pricingPageViews} times`,
      points: b.pricingViewsTwoOrMore,
    });
  } else if (activity.pricingPageViews === 1) {
    behavior.push({ group: "intent", label: "Viewed pricing once", points: b.pricingViewsOne });
  }
  if (activity.docsVisits >= 3) {
    behavior.push({
      group: "intent",
      label: `Read the docs ${activity.docsVisits} times`,
      points: b.docsVisitsThreeOrMore,
    });
  }
  if (activity.webinarAttended) {
    behavior.push({ group: "intent", label: "Attended a webinar", points: b.webinarAttended });
  }
  if (activity.emailClicks >= 2) {
    behavior.push({
      group: "intent",
      label: `Clicked ${activity.emailClicks} emails`,
      points: b.emailClicksTwoOrMore,
    });
  }
  const behaviorTotal = behavior.reduce((sum, line) => sum + line.points, 0);
  lines.push(...behavior);
  if (behaviorTotal > b.cap) {
    lines.push({
      group: "intent",
      label: `Behavior capped at ${b.cap}`,
      points: b.cap - behaviorTotal,
    });
  }
  const days = activity.lastActivityDaysAgo;
  if (days !== null && days <= 3) {
    lines.push({
      group: "intent",
      label: "Active in the last 3 days",
      points: INTENT_POINTS.recency.withinThreeDays,
    });
  } else if (days !== null && days <= 7) {
    lines.push({
      group: "intent",
      label: "Active in the last 7 days",
      points: INTENT_POINTS.recency.withinSevenDays,
    });
  }
  return lines;
}

export function aiLines(signals: AiSignals): ScoreLine[] {
  const lines: ScoreLine[] = [];
  const intentPoints = AI_POINTS.intent[signals.intent as keyof typeof AI_POINTS.intent];
  if (intentPoints !== undefined) {
    lines.push({ group: "ai", label: "AI: evaluating a solution", points: intentPoints });
  }
  const timelinePoints = AI_POINTS.timeline[signals.timeline as keyof typeof AI_POINTS.timeline];
  if (timelinePoints !== undefined) {
    const label = {
      within_30_days: "AI: timeline within 30 days",
      one_to_three_months: "AI: timeline 1 to 3 months",
      over_three_months: "AI: timeline over 3 months",
    }[signals.timeline as keyof typeof AI_POINTS.timeline];
    lines.push({ group: "ai", label, points: timelinePoints });
  }
  const budgetPoints = AI_POINTS.budget[signals.budget as keyof typeof AI_POINTS.budget];
  if (budgetPoints !== undefined) {
    const label = {
      approved: "AI: budget approved",
      in_planning: "AI: budget being planned",
      constrained: "AI: budget constrained",
    }[signals.budget as keyof typeof AI_POINTS.budget];
    lines.push({ group: "ai", label, points: budgetPoints });
  }
  const nextPoints = AI_POINTS.nextStep[signals.nextStep as keyof typeof AI_POINTS.nextStep];
  if (nextPoints !== undefined) {
    const label = {
      demo: "AI: asked for a demo",
      pricing: "AI: asked for pricing",
      call: "AI: asked for a call",
    }[signals.nextStep as keyof typeof AI_POINTS.nextStep];
    lines.push({ group: "ai", label, points: nextPoints });
  }
  const total = lines.reduce((sum, line) => sum + line.points, 0);
  const capped = clamp(total, AI_POINTS.min, AI_POINTS.max);
  if (capped !== total) {
    lines.push({
      group: "ai",
      label:
        capped === AI_POINTS.max
          ? `AI points capped at ${AI_POINTS.max}`
          : `AI points floored at ${AI_POINTS.min}`,
      points: capped - total,
    });
  }
  return lines;
}

export function scoreLead(
  lead: Lead,
  ai: AiSignals | null,
  weights: GroupWeights = DEFAULT_WEIGHTS,
): ScoreResult {
  const lines = [...fitLines(lead), ...intentLines(lead), ...(ai ? aiLines(ai) : [])];
  const sum = (group: ScoreGroup) =>
    lines.filter((line) => line.group === group).reduce((total, line) => total + line.points, 0);
  const groups: Record<ScoreGroup, number> = {
    fit: clamp(sum("fit"), GROUP_LIMITS.fit.min, GROUP_LIMITS.fit.max),
    intent: clamp(sum("intent"), GROUP_LIMITS.intent.min, GROUP_LIMITS.intent.max),
    ai: clamp(sum("ai"), GROUP_LIMITS.ai.min, GROUP_LIMITS.ai.max),
  };
  const weighted =
    groups.fit * weights.fit + groups.intent * weights.intent + groups.ai * weights.ai;
  return { total: Math.round(clamp(weighted, 0, 100)), groups, lines };
}
