/**
 * Turns simulation runs into decisions: which automation to switch next, and which motion gets
 * the next dollar. Every recommendation is a comparison of two runs over the same leads.
 */
import {
  ALL_OFF,
  AUTOMATION_IDS,
  type AutomationId,
  type Automations,
  MOTION_IDS,
  type MotionId,
  TEAM,
} from "./model";
import { type Custom, type SimResult, simulate } from "./simulate";

export interface Move {
  automation: AutomationId;
  /** True if the move turns it on, false if it turns it off. */
  turnOn: boolean;
  deltaMeetings: number;
  deltaPipeline: number;
  deltaCostPerMeeting: number;
  deltaRepHours: number;
}

export interface Decision {
  current: SimResult;
  baseline: SimResult;
  /** Every single switch from the current setup, best first. */
  moves: Move[];
  /** The best move that adds meetings, if any. */
  next: Move | null;
  /** For automations that are on: what switching each off would change, most damaging first. */
  contributions: Move[];
}

function flip(automations: Automations, id: AutomationId): Automations {
  return { ...automations, [id]: !automations[id] };
}

export function decide(motion: MotionId, automations: Automations, custom: Custom = {}): Decision {
  const current = simulate(motion, automations, custom);
  const baseline = simulate(motion, ALL_OFF, custom);
  const moves = AUTOMATION_IDS.map((id): Move => {
    const other = simulate(motion, flip(automations, id), custom);
    return {
      automation: id,
      turnOn: !automations[id],
      deltaMeetings: other.meetings - current.meetings,
      deltaPipeline: other.pipeline - current.pipeline,
      deltaCostPerMeeting: other.costPerMeeting - current.costPerMeeting,
      deltaRepHours: other.repHours - current.repHours,
    };
  }).sort((a, b) => b.deltaMeetings - a.deltaMeetings || b.deltaPipeline - a.deltaPipeline);
  const next = moves.find((move) => move.deltaMeetings > 0) ?? null;
  const contributions = moves
    .filter((move) => !move.turnOn)
    .sort((a, b) => a.deltaMeetings - b.deltaMeetings);
  return { current, baseline, moves, next, contributions };
}

export interface MotionRow {
  motion: MotionId;
  result: SimResult;
}

/** The same automations applied to every motion, cheapest meeting first. */
export function compareMotions(automations: Automations): MotionRow[] {
  return MOTION_IDS.map((motion) => ({ motion, result: simulate(motion, automations) })).sort(
    (a, b) => a.result.costPerMeeting - b.result.costPerMeeting,
  );
}

export interface PlanStep {
  move: Move;
  /** The result after this step. */
  result: SimResult;
}

export interface Plan {
  start: SimResult;
  steps: PlanStep[];
}

/** Follow the recommendation from a starting setup until no single switch adds meetings. */
export function plan(motion: MotionId, from: Automations, custom: Custom = {}): Plan {
  let automations = { ...from };
  let decision = decide(motion, automations, custom);
  const start = decision.current;
  const steps: PlanStep[] = [];
  for (let i = 0; i < AUTOMATION_IDS.length * 2 && decision.next; i++) {
    const move = decision.next;
    automations = { ...automations, [move.automation]: move.turnOn };
    decision = decide(motion, automations, custom);
    steps.push({ move, result: decision.current });
  }
  return { start, steps };
}

/** What one improvement in a plan is worth, per year, in US dollars. */
export interface StepValue {
  automation: AutomationId;
  meetingsPerQuarter: number;
  pipelinePerQuarter: number;
  /** Extra pipeline that closes, at the team's win rate, over four quarters. */
  revenuePerYear: number;
  /** Change in tools plus rep time, over four quarters. Negative means it saves money. */
  costPerYear: number;
  netPerYear: number;
}

export interface PlanValue {
  steps: StepValue[];
  total: Omit<StepValue, "automation">;
}

/** The simulated quarter is 90 days; a year is counted as four of them. */
const QUARTERS_PER_YEAR = 4;

/** Put a dollar figure on each step of a plan, from the same simulation runs. */
export function valuePlan(p: Plan): PlanValue {
  let previous = p.start;
  const steps = p.steps.map(({ move, result }): StepValue => {
    const pipeline = result.pipeline - previous.pipeline;
    const revenuePerYear = pipeline * TEAM.winRate * QUARTERS_PER_YEAR;
    const costPerYear = (result.totalCost - previous.totalCost) * QUARTERS_PER_YEAR;
    const value = {
      automation: move.automation,
      meetingsPerQuarter: result.meetings - previous.meetings,
      pipelinePerQuarter: pipeline,
      revenuePerYear,
      costPerYear,
      netPerYear: revenuePerYear - costPerYear,
    };
    previous = result;
    return value;
  });
  const sum = (key: keyof Omit<StepValue, "automation">) =>
    steps.reduce((total, step) => total + step[key], 0);
  return {
    steps,
    total: {
      meetingsPerQuarter: sum("meetingsPerQuarter"),
      pipelinePerQuarter: sum("pipelinePerQuarter"),
      revenuePerYear: sum("revenuePerYear"),
      costPerYear: sum("costPerYear"),
      netPerYear: sum("netPerYear"),
    },
  };
}
