/**
 * Plain-language explanation of what a settings change did: what you changed, which leads
 * moved, what happened to the headline numbers, and why. Generated from the decisions, never
 * written by hand, so it is always about the data on screen.
 */
import { AI_POLICY_LABELS } from "../ai/signals";
import { type Decision, QUEUE_ORDER_LABELS } from "../routing/route";
import type { ScoreGroup } from "../scoring/score";
import type { LabSettings } from "../settings";
import type { Metrics } from "./metrics";

export type MarkState = "called" | "waiting" | "review" | "nurture" | "fix_data" | "not_for_sales";

export const STATE_LABELS: Record<MarkState, string> = {
  called: "Sales now (called)",
  waiting: "Sales now (over capacity)",
  review: "Human review",
  nurture: "Nurture",
  fix_data: "Fix data",
  not_for_sales: "Not for sales",
};

export function stateOf(decision: Decision): MarkState {
  if (decision.lane === "sales") return decision.called ? "called" : "waiting";
  return decision.lane;
}

export interface Flow {
  from: MarkState;
  to: MarkState;
  leads: number;
  withNeed: number;
}

export interface Explanation {
  change: string;
  movement: string;
  effect: string;
  insight: string | null;
  flows: Flow[];
  /** Leads whose state changed, to highlight them. */
  movedLeadIds: string[];
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : pluralForm}`;
}

const percent = (part: number, total: number) => `${Math.round((100 * part) / total)}%`;

const GROUP_NAMES: Record<ScoreGroup, string> = { fit: "fit", intent: "intent", ai: "AI" };

function describeChange(before: LabSettings, after: LabSettings): string | null {
  const changes: string[] = [];
  if (before.capacity !== after.capacity) {
    changes.push(
      `You ${after.capacity > before.capacity ? "raised" : "lowered"} sales capacity from ${before.capacity} to ${after.capacity} calls a week.`,
    );
  }
  if (before.threshold !== after.threshold) {
    changes.push(
      `You ${after.threshold > before.threshold ? "raised" : "lowered"} the score threshold from ${before.threshold} to ${after.threshold}.`,
    );
  }
  if (before.aiPolicy !== after.aiPolicy) {
    if (before.aiPolicy === "off") {
      changes.push(
        `You turned AI signals on, trusting ${AI_POLICY_LABELS[after.aiPolicy].toLowerCase()}.`,
      );
    } else if (after.aiPolicy === "off") {
      changes.push("You turned AI signals off.");
    } else {
      changes.push(
        `You changed the AI policy to ${AI_POLICY_LABELS[after.aiPolicy].toLowerCase()}.`,
      );
    }
  }
  if (before.queueOrder !== after.queueOrder) {
    changes.push(
      `You switched the sales queue to ${QUEUE_ORDER_LABELS[after.queueOrder].toLowerCase()}.`,
    );
  }
  for (const group of ["fit", "intent", "ai"] as const) {
    if (before.weights[group] !== after.weights[group]) {
      changes.push(
        `You changed the weight of ${GROUP_NAMES[group]} points from ×${before.weights[group]} to ×${after.weights[group]}.`,
      );
    }
  }
  if (before.extraction !== after.extraction) {
    changes.push(
      after.extraction === "answer_key"
        ? "You replaced the model's answers with the answer key, to see what perfect extraction would do."
        : "You switched back to the model's stored answers.",
    );
  }
  if (changes.length === 0) return null;
  return changes.length === 1 ? (changes[0] ?? null) : "You changed several settings at once.";
}

export function computeFlows(
  before: Decision[],
  after: Decision[],
  hasNeed: (leadId: string) => boolean,
): { flows: Flow[]; movedLeadIds: string[] } {
  const previous = new Map(before.map((decision) => [decision.leadId, stateOf(decision)]));
  const flows = new Map<string, Flow>();
  const movedLeadIds: string[] = [];
  for (const decision of after) {
    const from = previous.get(decision.leadId);
    const to = stateOf(decision);
    if (!from || from === to) continue;
    movedLeadIds.push(decision.leadId);
    const key = `${from}>${to}`;
    const flow = flows.get(key) ?? { from, to, leads: 0, withNeed: 0 };
    flow.leads++;
    if (hasNeed(decision.leadId)) flow.withNeed++;
    flows.set(key, flow);
  }
  return {
    flows: [...flows.values()].sort((a, b) => b.leads - a.leads || b.withNeed - a.withNeed),
    movedLeadIds,
  };
}

function describeFlow(flow: Flow): string {
  const need =
    flow.withNeed === 0
      ? "none with a real need"
      : flow.withNeed === flow.leads
        ? flow.leads === 1
          ? "with a real need"
          : "all with a real need"
        : `${flow.withNeed} with a real need`;
  return `${plural(flow.leads, "lead")} moved from ${STATE_LABELS[flow.from]} to ${STATE_LABELS[flow.to]}, ${need}`;
}

function describeEffect(before: Metrics, after: Metrics): string {
  const reached =
    before.needsReached === after.needsReached
      ? `Needs reached stayed at ${after.needsReached} of ${after.needsTotal}`
      : `Needs reached went from ${before.needsReached} to ${after.needsReached} of ${after.needsTotal}`;
  const wasted =
    before.callsWithoutNeed === after.callsWithoutNeed
      ? `calls without a need stayed at ${after.callsWithoutNeed}`
      : `calls without a need went from ${before.callsWithoutNeed} to ${after.callsWithoutNeed}`;
  const review =
    before.reviewCases !== after.reviewCases
      ? ` ${plural(after.reviewCases, "lead")} now ${after.reviewCases === 1 ? "waits" : "wait"} for human review.`
      : "";
  return `${reached}, and ${wasted}.${review}`;
}

function describeInsight(
  before: { settings: LabSettings; metrics: Metrics },
  after: { settings: LabSettings; metrics: Metrics },
  flows: Flow[],
): string | null {
  const b = before.metrics;
  const a = after.metrics;
  const s0 = before.settings;
  const s1 = after.settings;

  if (s0.threshold !== s1.threshold) {
    if (b.callsMade === a.callsMade && a.callsMade === s1.capacity) {
      return "Every call was already in use, so the threshold changed who waits and who goes to nurture, not who gets called.";
    }
    if (a.callsMade < s1.capacity) {
      const unused = s1.capacity - a.callsMade;
      return `Only ${plural(a.callsMade, "lead")} now ${a.callsMade === 1 ? "clears" : "clear"} the threshold, so ${plural(unused, "call")} ${unused === 1 ? "goes" : "go"} unused.`;
    }
    return null;
  }

  if (s0.capacity !== s1.capacity) {
    const extraCalls = a.callsMade - b.callsMade;
    const extraNeeds = a.needsReached - b.needsReached;
    if (extraCalls === 0) {
      return "The sales queue is shorter than the new capacity, so the extra calls have nobody to go to.";
    }
    if (extraCalls > 0 && b.callsMade > 0) {
      return `The ${plural(extraCalls, "extra call")} reached ${plural(extraNeeds, "more need")} (${percent(extraNeeds, extraCalls)}), compared with ${percent(b.callsWithNeed, b.callsMade)} for the first ${b.callsMade}: each additional call goes further down the queue.`;
    }
    if (extraCalls < 0) {
      return `The ${plural(-extraCalls, "call")} you removed had been reaching ${plural(-extraNeeds, "need")}.`;
    }
    return null;
  }

  if (s0.queueOrder !== s1.queueOrder) {
    const delta = a.needsReached - b.needsReached;
    if (s1.queueOrder === "arrival") {
      return delta < 0
        ? `Arrival time says nothing about need: with the same ${plural(a.callsMade, "call")}, ${plural(-delta, "fewer need")} ${delta === -1 ? "was" : "were"} reached.`
        : "With this threshold the queue is short, so order matters little: arrival order reached as many needs as the score did.";
    }
    return delta > 0
      ? `Ordering by score put the strongest leads first: ${plural(delta, "more need")} ${delta === 1 ? "was" : "were"} reached with the same calls.`
      : "With this threshold the queue is short, so order matters little this week.";
  }

  if (s0.aiPolicy !== s1.aiPolicy || s0.extraction !== s1.extraction) {
    const gained = flows.filter((f) => f.to === "called");
    const lost = flows.filter((f) => f.from === "called");
    const gainedLeads = gained.reduce((sum, f) => sum + f.leads, 0);
    const gainedNeeds = gained.reduce((sum, f) => sum + f.withNeed, 0);
    const lostNeeds = lost.reduce((sum, f) => sum + f.withNeed, 0);
    const excluded = flows
      .filter((f) => f.to === "not_for_sales")
      .reduce((sum, f) => sum + f.leads, 0);
    const parts: string[] = [];
    if (gainedLeads > 0) {
      parts.push(
        `${plural(gainedLeads, "lead")} gained a call, ${gainedNeeds} of them with a real need; the leads they replaced had ${plural(lostNeeds, "real need")}.`,
      );
    }
    if (excluded > 0) {
      parts.push(
        `${plural(excluded, "lead")} left the funnel as support requests, vendor pitches, job inquiries or spam.`,
      );
    }
    if (a.reviewCases > 0 && s1.aiPolicy !== "off") {
      parts.push(
        "Human review holds the cases where a signal was below the confidence policy but would have changed the lane, and messages that tried to instruct the AI.",
      );
    }
    return parts.length > 0 ? parts.join(" ") : null;
  }

  if (
    s0.weights.fit !== s1.weights.fit ||
    s0.weights.intent !== s1.weights.intent ||
    s0.weights.ai !== s1.weights.ai
  ) {
    return "Weights change both who clears the threshold and the order of the queue.";
  }
  return null;
}

export function explainChange(args: {
  before: { settings: LabSettings; decisions: Decision[]; metrics: Metrics };
  after: { settings: LabSettings; decisions: Decision[]; metrics: Metrics };
  hasNeed: (leadId: string) => boolean;
}): Explanation | null {
  const { before, after } = args;
  if (before.settings.week !== after.settings.week) return null;
  const change = describeChange(before.settings, after.settings);
  if (!change) return null;
  const { flows, movedLeadIds } = computeFlows(before.decisions, after.decisions, args.hasNeed);
  const top = flows.slice(0, 2).map(describeFlow);
  const rest = flows.slice(2).reduce((sum, flow) => sum + flow.leads, 0);
  let movement = "No lead changed lane.";
  if (top.length > 0) {
    movement = `${top.join("; ")}${rest > 0 ? `; ${plural(rest, "other lead")} moved too` : ""}.`;
  }
  return {
    change,
    movement,
    effect: describeEffect(before.metrics, after.metrics),
    insight: describeInsight(before, after, flows),
    flows,
    movedLeadIds,
  };
}
