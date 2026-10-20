/**
 * Routing: put every lead in exactly one lane, with one reason. Eligibility rules run first, in
 * a fixed order, and the first match wins. Only leads that pass every rule are scored against
 * the threshold. Sales can only call so many people a week, so qualified leads form a queue and
 * the capacity dial decides where the line falls.
 */
import { type AiPolicy, isTrusted, type LeadAiSignals } from "../ai/signals";
import type { Lead } from "../cleaning/pipeline";
import type { Intent } from "../model";
import { DEFAULT_WEIGHTS, type GroupWeights, type ScoreResult, scoreLead } from "../scoring/score";

export const LANES = ["sales", "review", "nurture", "fix_data", "not_for_sales"] as const;
export type Lane = (typeof LANES)[number];

export const LANE_LABELS: Record<Lane, string> = {
  sales: "Sales now",
  review: "Human review",
  nurture: "Nurture",
  fix_data: "Fix data",
  not_for_sales: "Not for sales",
};

export const REASONS = {
  INVALID_CONTACT: "No valid email to reach this person",
  SUPPRESSED: "Asked not to be contacted",
  COMPETITOR: "Works at a competitor",
  EXISTING_CUSTOMER: "Already a customer: goes to the customer team",
  UNIDENTIFIED_COMPANY: "Personal email and no company: needs research first",
  INJECTION: "Message tried to instruct the AI: a person should read it",
  AI_UNTRUSTED_CHANGES_LANE:
    "AI signal would change the lane, but its confidence is below the policy",
  AI_SUPPORT: "AI: existing customer asking for support",
  AI_VENDOR: "AI: vendor or partner pitch",
  AI_SPAM: "AI: spam",
  AI_JOB: "AI: job inquiry",
  AI_STUDENT: "AI: student or research request",
  SCORE_ABOVE_THRESHOLD: "Score at or above the threshold",
  SCORE_BELOW_THRESHOLD: "Score below the threshold",
} as const;
export type ReasonCode = keyof typeof REASONS;

export type QueueOrder = "score" | "arrival";

export const QUEUE_ORDER_LABELS: Record<QueueOrder, string> = {
  score: "Highest score first",
  arrival: "First come, first served",
};

export interface RoutingSettings {
  /** Sales calls available this week. */
  capacity: number;
  /** Minimum score for the sales queue. */
  threshold: number;
  aiPolicy: AiPolicy;
  queueOrder: QueueOrder;
  weights: GroupWeights;
}

export const DEFAULT_ROUTING: RoutingSettings = {
  capacity: 45,
  threshold: 55,
  aiPolicy: "off",
  queueOrder: "score",
  weights: DEFAULT_WEIGHTS,
};

export interface Decision {
  leadId: string;
  lane: Lane;
  reason: ReasonCode;
  score: ScoreResult;
  /** AI signals were trusted and used in this decision. */
  aiUsed: boolean;
  /** The lane this lead would get with AI turned off. */
  laneWithoutAi: Lane;
  /** Position in the sales queue, from 1. Null outside the sales lane. */
  queuePosition: number | null;
  /** In the sales lane and within this week's capacity. */
  called: boolean;
}

interface Classification {
  lane: Lane;
  reason: ReasonCode;
  score: ScoreResult;
}

export interface DataRule {
  code: ReasonCode;
  lane: Lane;
  /** What passing the rule means, for the case file. */
  check: string;
  fails: (lead: Lead) => boolean;
}

/** Eligibility rules that need only the cleaned data, in the order they run. */
export const DATA_RULES: DataRule[] = [
  {
    code: "INVALID_CONTACT",
    lane: "fix_data",
    check: "Has a valid email",
    fails: (lead) => lead.emailStatus !== "valid",
  },
  {
    code: "SUPPRESSED",
    lane: "not_for_sales",
    check: "Not on the opt-out list",
    fails: (lead) => lead.suppressed,
  },
  {
    code: "COMPETITOR",
    lane: "not_for_sales",
    check: "Not a competitor",
    fails: (lead) => Boolean(lead.match?.company.isCompetitor),
  },
  {
    code: "EXISTING_CUSTOMER",
    lane: "not_for_sales",
    check: "Not an existing customer",
    fails: (lead) => Boolean(lead.match?.company.isCustomer),
  },
  {
    code: "UNIDENTIFIED_COMPANY",
    lane: "fix_data",
    check: "Company identified",
    fails: (lead) => !lead.match && lead.isFreemail && !lead.companyName,
  },
];

/** Intents that take a lead out of the sales funnel when the AI signal is trusted. */
export const AI_INTENT_RULES: Partial<Record<Intent, { lane: Lane; code: ReasonCode }>> = {
  existing_customer_support: { lane: "not_for_sales", code: "AI_SUPPORT" },
  vendor_or_partner_pitch: { lane: "not_for_sales", code: "AI_VENDOR" },
  spam: { lane: "not_for_sales", code: "AI_SPAM" },
  job_inquiry: { lane: "not_for_sales", code: "AI_JOB" },
  student_or_research: { lane: "nurture", code: "AI_STUDENT" },
};

/** The first data rule the lead fails, or null when it passes all of them. */
export function dataRule(lead: Lead): { lane: Lane; reason: ReasonCode } | null {
  for (const rule of DATA_RULES) {
    if (rule.fails(lead)) return { lane: rule.lane, reason: rule.code };
  }
  return null;
}

function classify(lead: Lead, ai: LeadAiSignals | null, settings: RoutingSettings): Classification {
  const score = scoreLead(lead, ai, settings.weights);
  const data = dataRule(lead);
  if (data) return { ...data, score };
  const intentRule = ai ? AI_INTENT_RULES[ai.intent] : undefined;
  if (intentRule) return { lane: intentRule.lane, reason: intentRule.code, score };
  return score.total >= settings.threshold
    ? { lane: "sales", reason: "SCORE_ABOVE_THRESHOLD", score }
    : { lane: "nurture", reason: "SCORE_BELOW_THRESHOLD", score };
}

function decideLane(
  lead: Lead,
  ai: LeadAiSignals | null,
  settings: RoutingSettings,
): Classification & { aiUsed: boolean; laneWithoutAi: Lane } {
  const withoutAi = classify(lead, null, settings);
  if (settings.aiPolicy === "off" || ai === null) {
    return { ...withoutAi, aiUsed: false, laneWithoutAi: withoutAi.lane };
  }
  // Data rules come first: AI cannot override a missing email or a suppression.
  if (dataRule(lead)) return { ...withoutAi, aiUsed: false, laneWithoutAi: withoutAi.lane };
  if (ai.injection) {
    return {
      lane: "review",
      reason: "INJECTION",
      score: withoutAi.score,
      aiUsed: false,
      laneWithoutAi: withoutAi.lane,
    };
  }
  if (isTrusted(ai.confidence, settings.aiPolicy)) {
    return { ...classify(lead, ai, settings), aiUsed: true, laneWithoutAi: withoutAi.lane };
  }
  // Untrusted signal: ignore it, unless it would have changed the lane. Then a person decides.
  const ifTrusted = classify(lead, ai, settings);
  if (ifTrusted.lane !== withoutAi.lane) {
    return {
      lane: "review",
      reason: "AI_UNTRUSTED_CHANGES_LANE",
      score: withoutAi.score,
      aiUsed: false,
      laneWithoutAi: withoutAi.lane,
    };
  }
  return { ...withoutAi, aiUsed: false, laneWithoutAi: withoutAi.lane };
}

/** Order of the sales queue. Ties break on arrival, then id, so the order is stable. */
export function compareQueue(
  a: { score: number; firstTouchAt: string; leadId: string },
  b: { score: number; firstTouchAt: string; leadId: string },
  order: QueueOrder,
): number {
  if (order === "score" && a.score !== b.score) return b.score - a.score;
  return a.firstTouchAt.localeCompare(b.firstTouchAt) || a.leadId.localeCompare(b.leadId);
}

export function routeLeads(
  leads: Lead[],
  aiByLead: ReadonlyMap<string, LeadAiSignals>,
  settings: RoutingSettings,
): Decision[] {
  const decisions = leads.map((lead) => {
    const result = decideLane(lead, aiByLead.get(lead.leadId) ?? null, settings);
    return {
      lead,
      decision: {
        leadId: lead.leadId,
        lane: result.lane,
        reason: result.reason,
        score: result.score,
        aiUsed: result.aiUsed,
        laneWithoutAi: result.laneWithoutAi,
        queuePosition: null,
        called: false,
      } as Decision,
    };
  });
  const queue = decisions
    .filter((entry) => entry.decision.lane === "sales")
    .sort((a, b) =>
      compareQueue(
        { score: a.decision.score.total, firstTouchAt: a.lead.firstTouchAt, leadId: a.lead.leadId },
        { score: b.decision.score.total, firstTouchAt: b.lead.firstTouchAt, leadId: b.lead.leadId },
        settings.queueOrder,
      ),
    );
  queue.forEach((entry, index) => {
    entry.decision.queuePosition = index + 1;
    entry.decision.called = index < settings.capacity;
  });
  return decisions.map((entry) => entry.decision);
}
