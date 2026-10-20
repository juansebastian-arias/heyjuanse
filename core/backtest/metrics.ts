/**
 * Reference implementation of the backtest metrics, in TypeScript. The site computes the same
 * numbers in SQL, in the browser, and a test checks that both agree.
 *
 * The unit is a "need": a real person who, according to the answer key, has a qualified
 * new-business need this week. A person can appear as more than one lead when a duplicate was
 * missed, so each need takes the best outcome among its leads.
 */
import type { LabelsFile } from "../data/files";
import type { Decision, Lane } from "../routing/route";

export type NeedOutcome = "reached" | "review" | "waiting" | "fix_data" | "missed";

/** Best first. */
export const OUTCOME_ORDER: NeedOutcome[] = ["reached", "review", "waiting", "fix_data", "missed"];

export const OUTCOME_LABELS: Record<NeedOutcome, string> = {
  reached: "Reached this week",
  review: "Waiting on human review",
  waiting: "Qualified, but over capacity",
  fix_data: "Stuck in data fixes",
  missed: "Sent to nurture or excluded",
};

export interface Metrics {
  needsTotal: number;
  needsReached: number;
  needsInReview: number;
  needsWaiting: number;
  needsFixData: number;
  needsMissed: number;
  callsMade: number;
  callsWithNeed: number;
  callsWithoutNeed: number;
  /** Share of calls that reached a real need. Null when no calls were made. */
  salesPrecision: number | null;
  reviewCases: number;
  laneCounts: Record<Lane, number>;
}

export interface LeadLabelIndex {
  /** Person ids behind each lead. */
  peopleByLead: Map<string, string[]>;
  needByPerson: Map<string, boolean>;
}

export function indexLabels(
  labels: LabelsFile,
  leads: Array<{ leadId: string; rawIds: string[] }>,
): LeadLabelIndex {
  const personByRaw = new Map<string, string>();
  const needByPerson = new Map<string, boolean>();
  for (const person of labels.people) {
    needByPerson.set(person.personId, person.hasNeed);
    for (const rawId of person.rawIds) personByRaw.set(rawId, person.personId);
  }
  const peopleByLead = new Map<string, string[]>();
  for (const lead of leads) {
    const people = new Set<string>();
    for (const rawId of lead.rawIds) {
      const person = personByRaw.get(rawId);
      if (person) people.add(person);
    }
    peopleByLead.set(lead.leadId, [...people].sort());
  }
  return { peopleByLead, needByPerson };
}

export function leadHasNeed(leadId: string, index: LeadLabelIndex): boolean {
  return (index.peopleByLead.get(leadId) ?? []).some((person) => index.needByPerson.get(person));
}

export function outcomeOf(decision: Decision): NeedOutcome {
  if (decision.lane === "sales") return decision.called ? "reached" : "waiting";
  if (decision.lane === "review") return "review";
  if (decision.lane === "fix_data") return "fix_data";
  return "missed";
}

export function computeMetrics(decisions: Decision[], index: LeadLabelIndex): Metrics {
  const laneCounts: Record<Lane, number> = {
    sales: 0,
    review: 0,
    nurture: 0,
    fix_data: 0,
    not_for_sales: 0,
  };
  let callsMade = 0;
  let callsWithNeed = 0;
  const bestOutcome = new Map<string, NeedOutcome>();
  for (const decision of decisions) {
    laneCounts[decision.lane]++;
    const hasNeed = leadHasNeed(decision.leadId, index);
    if (decision.called) {
      callsMade++;
      if (hasNeed) callsWithNeed++;
    }
    const outcome = outcomeOf(decision);
    for (const person of index.peopleByLead.get(decision.leadId) ?? []) {
      if (!index.needByPerson.get(person)) continue;
      const current = bestOutcome.get(person);
      if (!current || OUTCOME_ORDER.indexOf(outcome) < OUTCOME_ORDER.indexOf(current)) {
        bestOutcome.set(person, outcome);
      }
    }
  }
  const count = (outcome: NeedOutcome) =>
    [...bestOutcome.values()].filter((value) => value === outcome).length;
  const needsTotal = [...index.needByPerson.values()].filter(Boolean).length;
  return {
    needsTotal,
    needsReached: count("reached"),
    needsInReview: count("review"),
    needsWaiting: count("waiting"),
    needsFixData: count("fix_data"),
    needsMissed: count("missed"),
    callsMade,
    callsWithNeed,
    callsWithoutNeed: callsMade - callsWithNeed,
    salesPrecision: callsMade > 0 ? callsWithNeed / callsMade : null,
    reviewCases: laneCounts.review,
    laneCounts,
  };
}
