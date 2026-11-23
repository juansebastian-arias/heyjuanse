/**
 * Larkspur, the made-up company the site simulates, and every number the simulation uses.
 *
 * Larkspur sells route-planning software to companies that run delivery fleets. A customer
 * request goes through five teams before it becomes money: a reply, a quote, a contract, the
 * setup and the invoice. Nothing here comes from a real company. These are planning assumptions,
 * shown on the site next to the results and open to change there.
 *
 * Three kinds of numbers live in this file, and the site keeps them apart:
 *   - assumptions: how customers and teams behave (`Assumptions`);
 *   - decisions: what a visitor can change (`LEVERS` and extra people);
 *   - nothing else. Every result is computed by running the process.
 */
import { DAY, WORK_DAY } from "./calendar";
import { lognormalFromMedian } from "./dist";
import type { ProcessSpec, StationSpec } from "./engine";

export const STATION_IDS = ["reply", "quote", "contract", "setup", "invoice"] as const;
export type StationId = (typeof STATION_IDS)[number];

export interface StationInfo {
  id: StationId;
  /** The step, as a verb a customer would use. */
  name: string;
  team: string;
  /** One person on that team, for "hire another ...". */
  role: string;
  /** What the team does with each item. */
  does: string;
  /** What is waiting here. */
  unit: string;
}

export const STATIONS: Record<StationId, StationInfo> = {
  reply: {
    id: "reply",
    name: "Reply",
    team: "Sales desk",
    role: "sales rep",
    does: "Reads the request, looks the company up and writes back.",
    unit: "requests",
  },
  quote: {
    id: "quote",
    name: "Quote",
    team: "Account executives",
    role: "account executive",
    does: "Holds a call, shows the product and sends a quote.",
    unit: "calls",
  },
  contract: {
    id: "contract",
    name: "Contract",
    team: "Finance lead",
    role: "approver",
    does: "Checks the price and the terms, and approves the contract.",
    unit: "contracts",
  },
  setup: {
    id: "setup",
    name: "Set up",
    team: "Onboarding",
    role: "onboarding specialist",
    does: "Loads the customer's depots, vehicles and drivers, and trains the planners.",
    unit: "customers",
  },
  invoice: {
    id: "invoice",
    name: "Invoice",
    team: "Finance",
    role: "finance clerk",
    does: "Types the contract into the billing system and sends the first invoice.",
    unit: "invoices",
  },
};

/** Index of each station in the process. */
export const STATION_INDEX = Object.fromEntries(
  STATION_IDS.map((id, index) => [id, index]),
) as Record<StationId, number>;

/** Customers count as signed once the contract station lets them through. */
export const SIGNED_AFTER = STATION_INDEX.contract;

export interface Assumptions {
  // Demand
  /** Requests on an average Monday to Friday, and on a Saturday or Sunday. */
  requestsPerWeekday: number;
  requestsPerWeekendDay: number;
  /** Share of weekday requests sent between 9:00 and 18:00. */
  officeHoursShare: number;
  // Customers
  /** Share of requests from companies Larkspur can serve. The rest get a polite no. */
  fitShare: number;
  /** Share of those who say yes to the quote. */
  acceptShare: number;
  /** Share of accepted quotes that survive legal and procurement on the customer's side. */
  signShare: number;
  /** Share of contracts at list price with standard terms. */
  standardShare: number;
  /** Fleet size: the median, and the spread of its logarithm. */
  vehiclesMedian: number;
  vehiclesSigma: number;
  /** First-year price per vehicle, in US dollars, invoiced up front. */
  pricePerVehicle: number;
  /** Half the customers waiting at a station have left after this many calendar days. Null: they never leave. */
  patienceDays: Record<StationId, number | null>;
  patienceSigma: Record<StationId, number>;
  // Teams
  /** Times a day a manager hands the new requests out to the sales desk, evenly spaced from opening. */
  handoutsPerDay: number;
  people: Record<StationId, number>;
  /** Hours a day each person gives to this work. The rest of their day goes elsewhere. */
  hoursPerDay: Record<StationId, number>;
  /** Hands-on minutes per item, on average. */
  touchMinutes: Record<StationId, number>;
  /** Spread of the hands-on time, as a share of its average. */
  touchSpread: number;
  /** Share of hand-typed invoices with a mistake the customer disputes. */
  invoiceErrorShare: number;
  /** Calendar days before a disputed invoice is back on the clerk's desk. */
  disputeDays: number;
  /** Calendar days a customer takes to pay a correct invoice: the median, and the spread of its logarithm. */
  paymentDays: number;
  paymentSigma: number;
  // What each change does
  /** Minutes to check and send a reply the AI drafted, instead of writing it. */
  draftedReplyMinutes: number;
  /** Minutes per call and quote when the quote is filled in from the call notes and price list. */
  draftedQuoteMinutes: number;
  /** Hours of setup when the customer uploads their own depots, vehicles and drivers. */
  selfServeSetupMinutes: number;
  /** Minutes to check an invoice created from the contract, and its error rate. */
  syncedInvoiceMinutes: number;
  syncedInvoiceErrorShare: number;
  // Money
  /** Share of a sale left after the cost of serving the customer. */
  margin: number;
  /** Fully loaded monthly cost of one more person, in US dollars. */
  monthlyCost: Record<StationId, number>;
  /** Model usage per drafted reply, in US dollars. */
  costPerDraft: number;
}

export const BASE: Assumptions = {
  requestsPerWeekday: 14,
  requestsPerWeekendDay: 2,
  officeHoursShare: 0.75,
  fitShare: 0.6,
  acceptShare: 0.4,
  signShare: 0.95,
  standardShare: 0.7,
  vehiclesMedian: 28,
  vehiclesSigma: 0.8,
  pricePerVehicle: 180,
  patienceDays: { reply: 2, quote: 7, contract: 10, setup: 45, invoice: null },
  patienceSigma: { reply: 1, quote: 0.8, contract: 0.8, setup: 0.6, invoice: 0 },
  handoutsPerDay: 1,
  people: { reply: 1, quote: 4, contract: 1, setup: 2, invoice: 1 },
  hoursPerDay: { reply: 6, quote: 6, contract: 2, setup: 7, invoice: 1.5 },
  touchMinutes: { reply: 24, quote: 195, contract: 40, setup: 300, invoice: 25 },
  touchSpread: 0.5,
  invoiceErrorShare: 0.15,
  disputeDays: 7,
  paymentDays: 12,
  paymentSigma: 0.5,
  draftedReplyMinutes: 8,
  draftedQuoteMinutes: 150,
  selfServeSetupMinutes: 180,
  syncedInvoiceMinutes: 3,
  syncedInvoiceErrorShare: 0.01,
  margin: 0.8,
  monthlyCost: { reply: 4500, quote: 9000, contract: 2500, setup: 6000, invoice: 800 },
  costPerDraft: 0.03,
};

export type LeverId =
  | "routing"
  | "replyDrafts"
  | "quoteDrafts"
  | "autoApprove"
  | "selfServe"
  | "billingSync";

export type LeverKind = "rule" | "ai" | "automation" | "integration";

export interface Lever {
  id: LeverId;
  station: StationId;
  kind: LeverKind;
  /** The change, as an instruction. */
  name: string;
  /** What changes for the people doing the work. */
  what: string;
  /** The one thing it changes in the model. */
  mechanism: string;
  /** How it is usually built. */
  build: string;
  /** Running cost per month and one-off cost to build, in US dollars. */
  monthly: number;
  setup: number;
}

export const LEVERS: Record<LeverId, Lever> = {
  routing: {
    id: "routing",
    station: "reply",
    kind: "rule",
    name: "Assign each request the moment it arrives",
    what: "Rules pick the right rep by region and company size and alert them at once, instead of a manager sorting the inbox every morning.",
    mechanism: "Requests no longer wait for the next hand-out.",
    build:
      "A workflow on the CRM's new-lead event: enrich, apply the assignment rules, notify the owner in chat.",
    monthly: 100,
    setup: 2500,
  },
  replyDrafts: {
    id: "replyDrafts",
    station: "reply",
    kind: "ai",
    name: "Let AI draft the reply; the rep checks and sends",
    what: "An AI agent reads the request and the CRM record and writes the reply. A person edits and approves every one.",
    mechanism: "A reply takes 8 minutes of a rep's time instead of 24. Nothing else is assumed.",
    build:
      "One model call per request with a fixed output format, the routing rules in the prompt and an approval step before anything is sent.",
    monthly: 200,
    setup: 4000,
  },
  quoteDrafts: {
    id: "quoteDrafts",
    station: "quote",
    kind: "automation",
    name: "Fill in quotes from the call notes and the price list",
    what: "After the call, the quote is prepared from the notes, the fleet size and the price list. The account executive reviews it.",
    mechanism: "A call and its quote take 150 minutes instead of 195.",
    build: "Quote templates in the CRM, fed by structured call notes and a price table.",
    monthly: 400,
    setup: 6000,
  },
  autoApprove: {
    id: "autoApprove",
    station: "contract",
    kind: "rule",
    name: "Approve standard contracts automatically",
    what: "Contracts at list price with standard terms are approved by rule. Only exceptions wait for the finance lead.",
    mechanism: "Seven contracts in ten skip the approval queue.",
    build: "An approval rule on discount and terms fields, with an audit trail.",
    monthly: 100,
    setup: 3000,
  },
  selfServe: {
    id: "selfServe",
    station: "setup",
    kind: "automation",
    name: "Let customers upload their own fleet data",
    what: "Customers load depots, vehicles and drivers from a spreadsheet. The system checks the file and reports what to fix.",
    mechanism: "A setup takes 3 hours of a specialist's time instead of 5.",
    build: "An import with validation rules and a checklist that tracks each customer's progress.",
    monthly: 500,
    setup: 12000,
  },
  billingSync: {
    id: "billingSync",
    station: "invoice",
    kind: "integration",
    name: "Create the invoice from the signed contract",
    what: "The CRM sends the contract to the billing system. The clerk checks the invoice instead of typing it.",
    mechanism: "An invoice takes 3 minutes instead of 25, and mistakes fall from 15% to 1%.",
    build: "A sync between the CRM and the billing system, triggered when a contract is signed.",
    monthly: 250,
    setup: 5000,
  },
};

export const LEVER_IDS = Object.keys(LEVERS) as LeverId[];

/** Most extra people a visitor can add to one team. */
export const MAX_EXTRA_PEOPLE = 2;

/** What a visitor has changed: which improvements are on, and how many people were added. */
export interface Setup {
  on: readonly LeverId[];
  extra: Readonly<Partial<Record<StationId, number>>>;
}

export const TODAY: Setup = { on: [], extra: {} };

export function hasLever(setup: Setup, id: LeverId): boolean {
  return setup.on.includes(id);
}

export function extraPeople(setup: Setup, station: StationId): number {
  return setup.extra[station] ?? 0;
}

/** A stable name for a setup: the same choices in any order give the same key. */
export function setupKey(setup: Setup): string {
  const levers = LEVER_IDS.filter((id) => hasLever(setup, id)).join("+");
  const people = STATION_IDS.filter((id) => extraPeople(setup, id) > 0)
    .map((id) => `${id}:${extraPeople(setup, id)}`)
    .join("+");
  return `${levers}|${people}`;
}

export function withLever(setup: Setup, id: LeverId, on: boolean): Setup {
  const others = setup.on.filter((lever) => lever !== id);
  return { ...setup, on: on ? LEVER_IDS.filter((l) => l === id || others.includes(l)) : others };
}

export function withExtra(setup: Setup, station: StationId, count: number): Setup {
  const clamped = Math.min(MAX_EXTRA_PEOPLE, Math.max(0, Math.round(count)));
  return { ...setup, extra: { ...setup.extra, [station]: clamped } };
}

const patience = (a: Assumptions, id: StationId) => {
  const days = a.patienceDays[id];
  return days === null ? null : lognormalFromMedian(days * DAY, a.patienceSigma[id]);
};

/** The hands-on minutes per item at a station under a setup. */
export function touchMinutes(setup: Setup, id: StationId, a: Assumptions = BASE): number {
  if (id === "reply" && hasLever(setup, "replyDrafts")) return a.draftedReplyMinutes;
  if (id === "quote" && hasLever(setup, "quoteDrafts")) return a.draftedQuoteMinutes;
  if (id === "setup" && hasLever(setup, "selfServe")) return a.selfServeSetupMinutes;
  if (id === "invoice" && hasLever(setup, "billingSync")) return a.syncedInvoiceMinutes;
  return a.touchMinutes[id];
}

export function peopleAt(setup: Setup, id: StationId, a: Assumptions = BASE): number {
  return a.people[id] + extraPeople(setup, id);
}

/** Hours of this work the team can do in a day. */
export function capacityHours(setup: Setup, id: StationId, a: Assumptions = BASE): number {
  return peopleAt(setup, id, a) * a.hoursPerDay[id];
}

/** Working minutes after opening at which the manager hands out requests. */
export function handoutMinutes(a: Assumptions = BASE): number[] {
  const times = Math.max(1, Math.round(a.handoutsPerDay));
  return Array.from({ length: times }, (_, index) => Math.round((index * WORK_DAY) / times));
}

/** Turns a visitor's choices and the assumptions into the process the engine runs. */
export function resolve(setup: Setup, a: Assumptions = BASE): ProcessSpec {
  const station = (id: StationId, overrides: Partial<StationSpec> = {}): StationSpec => ({
    id,
    servers: peopleAt(setup, id, a),
    touch: { kind: "lognormal", mean: touchMinutes(setup, id, a), cv: a.touchSpread },
    stretch: WORK_DAY / (a.hoursPerDay[id] * 60),
    releaseAt: [],
    patience: patience(a, id),
    bypass: 0,
    rework: 0,
    reworkDelay: 0,
    ...overrides,
  });
  const synced = hasLever(setup, "billingSync");
  return {
    stations: [
      // Without routing rules, a manager hands out the inbox at fixed times, starting at opening.
      station("reply", { releaseAt: hasLever(setup, "routing") ? [] : handoutMinutes(a) }),
      station("quote"),
      station("contract", { bypass: hasLever(setup, "autoApprove") ? a.standardShare : 0 }),
      station("setup"),
      station("invoice", {
        rework: synced ? a.syncedInvoiceErrorShare : a.invoiceErrorShare,
        reworkDelay: a.disputeDays * DAY,
      }),
    ],
    payment: lognormalFromMedian(a.paymentDays * DAY, a.paymentSigma),
  };
}

export interface SetupCost {
  /** Running cost of the changes per month: tools and added people. Model usage is added from the run. */
  monthly: number;
  /** One-off cost to build the changes. */
  setup: number;
  people: number;
}

/** What a setup costs on top of how Larkspur runs today. */
export function costOf(setup: Setup, a: Assumptions = BASE): SetupCost {
  let monthly = 0;
  let build = 0;
  let people = 0;
  for (const id of setup.on) {
    monthly += LEVERS[id].monthly;
    build += LEVERS[id].setup;
  }
  for (const id of STATION_IDS) {
    people += extraPeople(setup, id);
    monthly += extraPeople(setup, id) * a.monthlyCost[id];
  }
  return { monthly, setup: build, people };
}
