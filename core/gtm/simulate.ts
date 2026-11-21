/**
 * A 90-day, lead-by-lead simulation of one go-to-market motion.
 *
 * Each motion's leads are generated once from a fixed seed, including every random draw that
 * decides an outcome. Turning an automation on or off therefore replays the same leads, and any
 * difference in the results comes from the automation alone (common random numbers).
 */
import { createRng, hashString } from "@/core/random";
import {
  AUTOMATION_IDS,
  AUTOMATIONS,
  type Automations,
  MOTIONS,
  type Motion,
  type MotionId,
  TEAM,
} from "./model";

export interface Lead {
  id: number;
  arrivalDay: number;
  /** Hour of the day it arrived, 0 to 24. */
  arrivalHour: number;
  fit: number;
  intent: number;
  hasNeed: boolean;
  duplicate: boolean;
  missingData: boolean;
  /** Day a later buying signal fires, or -1. */
  signalDay: number;
  signalNeed: boolean;
  uMeeting: number;
  uSignalMeeting: number;
  uOpportunity: number;
}

const EVENT_DAYS = [12, 41, 69];

function skewedMean(u: number, mean: number): number {
  // u^k has mean 1/(k+1), so this hits the requested mean while keeping the long tail.
  return u ** (1 / mean - 1);
}

const cache = new Map<MotionId, Lead[]>();

export function generateLeads(motion: Motion): Lead[] {
  const cached = cache.get(motion.id);
  if (cached) return cached;
  const rng = createRng(hashString(`gtm-sim:${motion.id}:v1`));
  const leads: Lead[] = [];
  for (let id = 0; id < motion.leads; id++) {
    const arrivalDay =
      motion.arrival === "bursts" && rng.chance(0.8)
        ? Math.min(TEAM.days - 1, rng.pick(EVENT_DAYS) + rng.int(0, 1))
        : rng.int(0, TEAM.days - 1);
    // Most leads arrive during business hours, some at night.
    const arrivalHour = rng.chance(0.75) ? 8 + rng.next() * 10 : rng.next() * 24;
    const fit = skewedMean(rng.next(), motion.fitMean);
    const intent = skewedMean(rng.next(), motion.intentMean);
    const needChance = Math.min(
      0.95,
      motion.needBase *
        (0.25 + 0.75 * (fit / motion.fitMean) * 0.5 + 0.75 * (intent / motion.intentMean) * 0.5),
    );
    const hasNeed = rng.chance(needChance);
    const duplicate = rng.chance(motion.duplicateRate);
    const missingData = rng.chance(motion.missingDataRate);
    const signals = rng.chance(motion.signalRate);
    const signalDay = signals ? arrivalDay + rng.int(12, 45) : -1;
    leads.push({
      id,
      arrivalDay,
      arrivalHour,
      fit,
      intent,
      hasNeed: hasNeed && !duplicate,
      duplicate,
      missingData,
      signalDay: signalDay < TEAM.days && !duplicate ? signalDay : -1,
      signalNeed: rng.chance(TEAM.signalNeed * (0.5 + fit)),
      uMeeting: rng.next(),
      uSignalMeeting: rng.next(),
      uOpportunity: rng.next(),
    });
  }
  leads.sort((a, b) => a.arrivalDay - b.arrivalDay || a.id - b.id);
  cache.set(motion.id, leads);
  return leads;
}

export interface StageCounts {
  captured: number;
  unique: number;
  enriched: number;
  prioritized: number;
  nurtured: number;
  worked: number;
  aiDrafted: number;
  meetings: number;
  opportunities: number;
}

export interface SimResult {
  motion: MotionId;
  automations: Automations;
  stages: StageCounts;
  meetings: number;
  opportunities: number;
  pipeline: number;
  /** Leads with a real need that no rep ever reached. */
  missedNeeds: number;
  /** Rep hours spent on duplicates. */
  wastedHours: number;
  repHours: number;
  /** Median hours from a lead arriving to its first touch, over worked leads. */
  medianHoursToTouch: number;
  /** Re-engaged by a buying signal and booked. */
  signalMeetings: number;
  totalCost: number;
  costPerMeeting: number;
  /** Meetings booked in each of the 13 weeks. */
  weeklyMeetings: number[];
}

/** How much a slow first touch lowers the chance of a meeting. */
export function speedFactor(hours: number, sensitivity: number): number {
  return 1 - sensitivity * 0.65 * (1 - Math.exp(-hours / 5));
}

function score(lead: Lead, automations: Automations): number {
  const knownFit = lead.missingData && !automations.enrichment ? 0.15 : lead.fit;
  return 0.55 * knownFit + 0.45 * lead.intent;
}

interface QueueItem {
  lead: Lead;
  /** Absolute hour (day * 24 + hour) from which a rep can work it. */
  readyAt: number;
  fromSignal: boolean;
  score: number;
}

export function simulate(motionId: MotionId, automations: Automations): SimResult {
  const motion = MOTIONS[motionId];
  const leads = generateLeads(motion);
  const capacityPerDay = TEAM.reps * TEAM.sellingHoursPerDay * 60;
  const routingHours = automations.instantRouting ? 0.1 : motion.manualRoutingHours;
  const lift = (lead: Lead) =>
    (automations.aiDrafts ? TEAM.aiLift : 1) *
    (!lead.missingData || automations.enrichment ? TEAM.enrichedLift : 1);

  const stages: StageCounts = {
    captured: leads.length,
    unique: 0,
    enriched: 0,
    prioritized: 0,
    nurtured: 0,
    worked: 0,
    aiDrafted: 0,
    meetings: 0,
    opportunities: 0,
  };
  const weekly = new Array<number>(Math.ceil(TEAM.days / 7)).fill(0);
  const touchHours: number[] = [];
  const reached = new Set<number>();
  const booked = new Set<number>();
  const signals: QueueItem[] = [];
  let queue: QueueItem[] = [];
  let next = 0;
  let minutesUsed = 0;
  let wastedMinutes = 0;
  let opportunities = 0;
  let signalMeetings = 0;

  const book = (lead: Lead, day: number, fromSignal: boolean) => {
    booked.add(lead.id);
    stages.meetings++;
    if (fromSignal) signalMeetings++;
    const week = Math.min(weekly.length - 1, Math.floor(day / 7));
    weekly[week] = (weekly[week] ?? 0) + 1;
    if (lead.uOpportunity < motion.meetingToOpportunity) opportunities++;
  };

  for (let day = 0; day < TEAM.days; day++) {
    for (let lead = leads[next]; lead && lead.arrivalDay === day; lead = leads[++next]) {
      if (lead.signalDay >= 0 && automations.signals) {
        signals.push({
          lead,
          readyAt: lead.signalDay * 24 + lead.arrivalHour + 0.1,
          fromSignal: true,
          score: 1,
        });
      }
      if (lead.duplicate && automations.dedupe) continue;
      if (!lead.duplicate) {
        stages.unique++;
        if (!lead.missingData || automations.enrichment) stages.enriched++;
      }
      const item: QueueItem = {
        lead,
        readyAt: day * 24 + lead.arrivalHour + routingHours,
        fromSignal: false,
        score: score(lead, automations),
      };
      if (automations.scoring && item.score < TEAM.nurtureBelow) {
        if (!lead.duplicate) stages.nurtured++;
        // The nurture track books a few meetings on its own, with no rep time.
        const chance = motion.baseReply * TEAM.nurtureShare * lift(lead);
        if (lead.hasNeed && lead.uMeeting < chance) book(lead, day, false);
        continue;
      }
      if (automations.scoring && !lead.duplicate) stages.prioritized++;
      queue.push(item);
    }

    const firing = signals.filter((item) => Math.floor(item.readyAt / 24) === day);
    if (firing.length) {
      for (const item of firing) if (!booked.has(item.lead.id)) queue.push(item);
      signals.splice(0, signals.length, ...signals.filter((item) => !firing.includes(item)));
    }

    queue = queue.filter((item) => day * 24 - item.readyAt <= TEAM.staleAfterDays * 24);
    if (day % 7 >= 5) continue;

    if (automations.scoring) {
      queue.sort((a, b) => b.score - a.score || a.readyAt - b.readyAt);
    } else {
      queue.sort((a, b) => a.readyAt - b.readyAt || a.lead.id - b.lead.id);
    }

    const open = day * 24 + TEAM.dayStart;
    const close = day * 24 + TEAM.dayEnd;
    let used = 0;
    const remaining: QueueItem[] = [];
    for (const item of queue) {
      const { lead } = item;
      const minutes =
        (automations.aiDrafts ? TEAM.aiMinutes : TEAM.manualMinutes) +
        (lead.missingData && !automations.enrichment ? TEAM.lookupMinutes : 0);
      // The team works through the day in parallel; this is when the touch happens.
      const now = open + (used / capacityPerDay) * (close - open);
      const touchAt = Math.max(now, item.readyAt);
      if (item.readyAt > close || used + minutes > capacityPerDay) {
        remaining.push(item);
        continue;
      }
      used += minutes;
      minutesUsed += minutes;
      if (lead.duplicate) {
        wastedMinutes += minutes;
        continue;
      }
      const startedAt = item.fromSignal ? item.readyAt : lead.arrivalDay * 24 + lead.arrivalHour;
      const hours = touchAt - startedAt;
      touchHours.push(hours);
      if (!item.fromSignal) {
        stages.worked++;
        reached.add(lead.id);
      }
      if (automations.aiDrafts) stages.aiDrafted++;
      const chance = Math.min(
        0.95,
        motion.baseReply * speedFactor(hours, motion.speedSensitivity) * lift(lead),
      );
      if (item.fromSignal) {
        if (lead.signalNeed && lead.uSignalMeeting < chance) book(lead, day, true);
      } else if (lead.hasNeed && lead.uMeeting < chance) {
        book(lead, day, false);
      }
    }
    queue = remaining;
  }

  if (!automations.dedupe) stages.unique = leads.length;
  stages.opportunities = opportunities;
  const repHours = minutesUsed / 60;
  const months = TEAM.days / 30;
  const toolCost = AUTOMATION_IDS.reduce(
    (sum, id) => sum + (automations[id] ? AUTOMATIONS[id].monthlyCost * months : 0),
    0,
  );
  const totalCost = leads.length * motion.costPerLead + repHours * TEAM.costPerRepHour + toolCost;
  const missedNeeds = leads.filter(
    (lead) => lead.hasNeed && !reached.has(lead.id) && !booked.has(lead.id),
  ).length;
  touchHours.sort((a, b) => a - b);
  return {
    motion: motionId,
    automations,
    stages,
    meetings: stages.meetings,
    opportunities,
    pipeline: opportunities * motion.dealSize,
    missedNeeds,
    wastedHours: wastedMinutes / 60,
    repHours,
    medianHoursToTouch: touchHours[Math.floor(touchHours.length / 2)] ?? 0,
    signalMeetings,
    totalCost,
    costPerMeeting: stages.meetings ? totalCost / stages.meetings : Number.POSITIVE_INFINITY,
    weeklyMeetings: weekly,
  };
}
