/**
 * The sentences the page writes from the model's numbers. They live here, apart from the
 * components, so each one can be read and tested against the measurement it describes.
 */
import {
  type Assumptions,
  LEVERS,
  type LeverKind,
  type Setup,
  STATIONS,
  type StationId,
} from "@/core/flow/company";
import type { Cause, Reading } from "@/core/flow/diagnose";
import { type Difference, isClear } from "@/core/flow/experiment";
import type { Move, Option, Verdict } from "@/core/flow/planner";
import {
  count,
  duration,
  hoursPerDay,
  money,
  payback,
  percent,
  plural,
  signedMoney,
} from "./format";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const article = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");

export type MoveKind = LeverKind | "hire";

export const KIND_LABEL: Record<MoveKind, string> = {
  rule: "Rule",
  ai: "AI with approval",
  automation: "Automation",
  integration: "Integration",
  hire: "Hire",
};

export function moveKind(move: Move): MoveKind {
  return move.kind === "lever" ? LEVERS[move.lever].kind : "hire";
}

/** The change, as an instruction: "Approve standard contracts automatically", "Hire a sales rep". */
export function moveName(move: Move): string {
  if (move.kind === "lever") return LEVERS[move.lever].name;
  const { role } = STATIONS[move.station];
  return `Hire ${article(role)} ${role}`;
}

/** What changes for the people doing the work. */
export function moveWhat(move: Move, a: Assumptions): string {
  if (move.kind === "lever") return LEVERS[move.lever].what;
  const info = STATIONS[move.station];
  return `One more ${info.role}, giving ${hoursPerDay(a.hoursPerDay[move.station])} a day to this work like the others.`;
}

/** The one thing the change does in the model. */
export function moveMechanism(move: Move): string {
  if (move.kind === "lever") return LEVERS[move.lever].mechanism;
  return "One more person at this step. Nothing else changes.";
}

/** What an option costs, in words: "$100 a month and $2,500 to build". */
export function costText(monthly: number, build: number): string {
  const parts: string[] = [];
  if (monthly > 0) parts.push(`${money(monthly)} a month`);
  if (build > 0) parts.push(`${money(build)} to build`);
  return parts.length > 0 ? parts.join(" and ") : "nothing";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  worth: "Worth it",
  unclear: "Too close to call",
  "costs more": "Costs more than it brings in",
};

/** Below this share of simulated quarters ending ahead, a verdict says how often it does. */
const NEARLY_ALWAYS = 0.9;

/** One sentence on whether an option pays, from its measured gain after costs. */
export function verdictText(option: Option): string {
  if (option.verdict === "worth") {
    const kept = `${capitalize(signedMoney(option.net.mean))} a month after its own cost`;
    // A gain can be real on average and still lose in a single quarter. Say so when it does.
    const often =
      option.net.positive < NEARLY_ALWAYS
        ? `${kept} on average: ahead in ${Math.round(option.net.positive * 10)} of 10 quarters.`
        : `${kept}.`;
    if (option.build <= 0 || option.paybackMonths === null) return often;
    return `${often} Repays what it costs to build ${payback(option.paybackMonths)}.`;
  }
  if (option.verdict === "unclear") {
    return "The gain after cost is within what luck alone produces from one quarter to the next.";
  }
  return `${capitalize(signedMoney(option.net.mean))} a month after its own cost.`;
}

/** The range eight simulated quarters in ten fall inside. */
export function rangeText(low: number, high: number, format: (value: number) => string): string {
  return `${format(low)} to ${format(high)} in 8 of 10 quarters`;
}

/** What customers at a step are waiting for, to finish "give up waiting ...". */
export const WAITING_FOR: Record<StationId, string> = {
  reply: "for a first reply",
  quote: "for a call and a quote",
  contract: "for the contract to be approved",
  setup: "to be set up",
  invoice: "for the invoice",
};

const CAUSE_HEADLINE: Record<Cause, string> = {
  handout: "Work waits to be handed out, not to be done.",
  overload: "More work arrives than the team has hours for.",
  full: "Work arrives as fast as the team can do it.",
  tight: "The team keeps up on average, with little to spare for a busy day.",
  hours: "The wait here is for the office to open.",
  turn: "The team has time to spare, and work still waits its turn.",
  clear: "Nothing waits long here.",
};

export function causeHeadline(reading: Reading): string {
  return CAUSE_HEADLINE[reading.cause];
}

/** Work arriving as a share of the hours the team has for it. */
export function loadShare(reading: Reading): number {
  return reading.capacityHours > 0 ? reading.loadHours / reading.capacityHours : 0;
}

/** "5.9 h of work arrive a day and the team has 6 h for it". */
export function loadText(reading: Reading): string {
  return `${hoursPerDay(reading.loadHours)} of work arrive a day and the team has ${hoursPerDay(reading.capacityHours)} for it`;
}

/** Why work waits at a step, in one or two sentences built from its reading. */
export function causeDetail(reading: Reading, a: Assumptions): string {
  const info = STATIONS[reading.station];
  const load = loadText(reading);
  switch (reading.cause) {
    case "handout": {
      const times = Math.max(1, Math.round(a.handoutsPerDay));
      const often = times === 1 ? "once a day, at 9:00" : `${times} times a day`;
      return `A manager hands out the inbox ${often}. Until then nobody owns a request: of the ${duration(reading.waitHours)} a customer waits on average, ${duration(reading.assignHours)} pass before it reaches a person.`;
    }
    case "overload":
      return `${capitalize(load)}. The line stops growing only because customers give up.`;
    case "full":
      return `${capitalize(load)}. With nothing to spare, one busy week leaves a line that outlasts customers' patience.`;
    case "tight":
      return `${capitalize(load)}: ${percent(loadShare(reading))} taken. A busy day leaves a line that takes days to clear.`;
    case "hours":
      return `What arrives after 18:00 or on a weekend waits until the next working morning. During the day the team keeps up: ${load}.`;
    case "turn": {
      const hours = a.hoursPerDay[reading.station];
      const reason =
        hours < 4
          ? `This work gets ${hoursPerDay(hours)} of the ${info.role}'s day, so each one waits among other duties`
          : `Each one takes a while and they arrive in bunches, so some wait for a free ${info.role}`;
      return `${capitalize(load)}. ${reason}.`;
    }
    case "clear":
      return `${capitalize(info.unit)} are picked up within ${duration(reading.waitHours)} on average. ${capitalize(load)}.`;
  }
}

/** "14 a month, worth $92k", or "none". */
export function lostText(reading: Reading): string {
  if (reading.lostBuyers < 0.05) return "none";
  return `${count(reading.lostBuyers)} a month, worth ${money(reading.lostValue)}`;
}

/** "1 person", "4 people". */
export function peopleText(people: number): string {
  return `${people} ${plural(people, "person", "people")}`;
}

/** The changes in a setup, as a short list for a heading: "2 changes", "1 change and 1 hire". */
export function setupText(setup: Setup): string {
  const changes = setup.on.length;
  const hires = Object.values(setup.extra).reduce((sum, value) => sum + (value ?? 0), 0);
  const parts: string[] = [];
  if (changes > 0) parts.push(`${changes} ${plural(changes, "change", "changes")}`);
  if (hires > 0) parts.push(`${hires} ${plural(hires, "hire", "hires")}`);
  return parts.length > 0 ? parts.join(" and ") : "no changes";
}

/** The two figures the page keeps comparing between a setup and today's company, for one month. */
export interface Month {
  /** Sales collected. */
  cash: number;
  /** Buyers who gave up waiting. */
  lostBuyers: number;
}

/** A figure that clearly moved, as the page prints it: what it is now and what it was. */
export interface Moved {
  now: string;
  was: string;
}

/**
 * What a setup has clearly changed against today's company, for the sentence that reports it. A
 * figure is named only when its difference is too large to be luck and still shows once both
 * sides are rounded for print; otherwise it is null, and the sentence says nothing moved.
 */
export function soFar(
  today: Month,
  now: Month,
  delta: Record<keyof Month, Difference>,
): { cash: Moved | null; lost: (Moved & { noun: string }) | null } {
  const cash = { now: money(now.cash), was: money(today.cash) };
  const lost = { now: count(now.lostBuyers), was: count(today.lostBuyers) };
  return {
    cash: isClear(delta.cash) && cash.now !== cash.was ? cash : null,
    lost:
      isClear(delta.lostBuyers) && lost.now !== lost.was
        ? { ...lost, noun: plural(now.lostBuyers, "buyer", "buyers") }
        : null,
  };
}
