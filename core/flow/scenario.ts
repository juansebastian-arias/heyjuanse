/**
 * A scenario is everything a visitor can set: the changes made to how Larkspur works, and the
 * assumptions they chose to replace with their own. It fits in a link, so a result can be sent
 * to someone else and reproduced exactly.
 */
import {
  type Assumptions,
  BASE,
  extraPeople,
  hasLever,
  LEVER_IDS,
  type LeverId,
  MAX_EXTRA_PEOPLE,
  type Setup,
  STATION_IDS,
  type StationId,
  TODAY,
} from "./company";
import { VOLUME_HEADROOM } from "./requests";

export const TWEAK_IDS = [
  "demand",
  "patience",
  "handouts",
  "accept",
  "price",
  "draft",
  "errors",
] as const;
export type TweakId = (typeof TWEAK_IDS)[number];

export interface Tweak {
  id: TweakId;
  /** The assumption, as a full phrase. */
  label: string;
  unit: string;
  /** The range a visitor can choose from, and the step between choices. */
  min: number;
  max: number;
  step: number;
  /** A plausibly lower and higher value, used to test how much a result depends on this assumption. */
  low: number;
  high: number;
  read(a: Assumptions): number;
  write(a: Assumptions, value: number): Assumptions;
}

export const TWEAKS: Record<TweakId, Tweak> = {
  demand: {
    id: "demand",
    label: "Requests on a weekday",
    unit: "requests",
    min: 8,
    max: Math.floor(BASE.requestsPerWeekday * VOLUME_HEADROOM),
    step: 1,
    low: 12,
    high: 16,
    read: (a) => a.requestsPerWeekday,
    write: (a, value) => ({
      ...a,
      requestsPerWeekday: value,
      requestsPerWeekendDay: (BASE.requestsPerWeekendDay * value) / BASE.requestsPerWeekday,
    }),
  },
  patience: {
    id: "patience",
    label: "Days until half the customers waiting for a first reply have gone elsewhere",
    unit: "days",
    min: 0.5,
    max: 6,
    step: 0.5,
    low: 1,
    high: 4,
    read: (a) => a.patienceDays.reply ?? 0,
    write: (a, value) => ({ ...a, patienceDays: { ...a.patienceDays, reply: value } }),
  },
  handouts: {
    id: "handouts",
    label: "Times a day a manager hands out new requests today",
    unit: "times",
    min: 1,
    max: 4,
    step: 1,
    low: 1,
    high: 2,
    read: (a) => a.handoutsPerDay,
    write: (a, value) => ({ ...a, handoutsPerDay: value }),
  },
  accept: {
    id: "accept",
    label: "Companies that say yes to the quote",
    unit: "%",
    min: 20,
    max: 60,
    step: 5,
    low: 30,
    high: 50,
    read: (a) => a.acceptShare * 100,
    write: (a, value) => ({ ...a, acceptShare: value / 100 }),
  },
  price: {
    id: "price",
    label: "Price per vehicle, first year",
    unit: "$",
    min: 100,
    max: 300,
    step: 20,
    low: 140,
    high: 220,
    read: (a) => a.pricePerVehicle,
    write: (a, value) => ({ ...a, pricePerVehicle: value }),
  },
  draft: {
    id: "draft",
    label: "Minutes a rep needs to check a reply the AI drafted",
    unit: "min",
    min: 4,
    max: 20,
    step: 2,
    low: 4,
    high: 16,
    read: (a) => a.draftedReplyMinutes,
    write: (a, value) => ({ ...a, draftedReplyMinutes: value }),
  },
  errors: {
    id: "errors",
    label: "Hand-typed invoices that have a mistake",
    unit: "%",
    min: 0,
    max: 30,
    step: 5,
    low: 5,
    high: 25,
    read: (a) => a.invoiceErrorShare * 100,
    write: (a, value) => ({ ...a, invoiceErrorShare: value / 100 }),
  },
};

/** The assumptions a visitor has replaced, by id. Anything missing keeps its base value. */
export type Tweaks = Readonly<Partial<Record<TweakId, number>>>;

export interface Scenario {
  setup: Setup;
  tweaks: Tweaks;
}

export const START: Scenario = { setup: TODAY, tweaks: {} };

/** Rounds a value to the tweak's steps and keeps it inside its range. */
export function snap(tweak: Tweak, value: number): number {
  const stepped = tweak.min + Math.round((value - tweak.min) / tweak.step) * tweak.step;
  const clamped = Math.min(tweak.max, Math.max(tweak.min, stepped));
  return Math.round(clamped * 1000) / 1000;
}

/** Drops tweaks that only restate the base value, so equal scenarios have equal keys. */
export function normalizeTweaks(tweaks: Tweaks): Tweaks {
  const kept: Partial<Record<TweakId, number>> = {};
  for (const id of TWEAK_IDS) {
    const value = tweaks[id];
    if (value === undefined || !Number.isFinite(value)) continue;
    const snapped = snap(TWEAKS[id], value);
    if (snapped !== snap(TWEAKS[id], TWEAKS[id].read(BASE))) kept[id] = snapped;
  }
  return kept;
}

/** The base assumptions with a visitor's replacements applied. */
export function assumptionsFor(tweaks: Tweaks): Assumptions {
  let a = BASE;
  for (const id of TWEAK_IDS) {
    const value = tweaks[id];
    if (value !== undefined) a = TWEAKS[id].write(a, snap(TWEAKS[id], value));
  }
  return a;
}

export function tweaksKey(tweaks: Tweaks): string {
  const normal = normalizeTweaks(tweaks);
  return TWEAK_IDS.filter((id) => normal[id] !== undefined)
    .map((id) => `${id}:${normal[id]}`)
    .join(",");
}

export function isChanged(setup: Setup): boolean {
  return setup.on.length > 0 || STATION_IDS.some((id) => extraPeople(setup, id) > 0);
}

/**
 * The scenario as the query string of a link: `on=routing,replyDrafts&hire=quote:1&if=demand:16`.
 * Empty for the starting point.
 */
export function encodeScenario(scenario: Scenario): string {
  const params: string[] = [];
  const on = LEVER_IDS.filter((id) => hasLever(scenario.setup, id));
  if (on.length > 0) params.push(`on=${on.join(",")}`);
  const hires = STATION_IDS.filter((id) => extraPeople(scenario.setup, id) > 0).map(
    (id) => `${id}:${extraPeople(scenario.setup, id)}`,
  );
  if (hires.length > 0) params.push(`hire=${hires.join(",")}`);
  const tweaks = tweaksKey(scenario.tweaks);
  if (tweaks) params.push(`if=${tweaks}`);
  return params.join("&");
}

/**
 * Reads a scenario from a query string. A link is outside input: anything unknown, out of range
 * or malformed is dropped, and what is left is always a valid scenario.
 */
export function decodeScenario(query: string): Scenario {
  const params = new URLSearchParams(query);
  const wanted = new Set((params.get("on") ?? "").split(","));
  const on = LEVER_IDS.filter((id: LeverId) => wanted.has(id));
  const extra: Partial<Record<StationId, number>> = {};
  for (const part of (params.get("hire") ?? "").split(",")) {
    const [id, count] = part.split(":");
    const station = STATION_IDS.find((known) => known === id);
    const people = Number(count);
    if (!station || !Number.isInteger(people) || people < 1) continue;
    extra[station] = Math.min(MAX_EXTRA_PEOPLE, people);
  }
  const tweaks: Partial<Record<TweakId, number>> = {};
  for (const part of (params.get("if") ?? "").split(",")) {
    const [id, raw] = part.split(":");
    const tweak = TWEAK_IDS.find((known) => known === id);
    const value = Number(raw);
    if (!tweak || raw === undefined || raw === "" || !Number.isFinite(value)) continue;
    tweaks[tweak] = value;
  }
  return { setup: { on, extra }, tweaks: normalizeTweaks(tweaks) };
}
