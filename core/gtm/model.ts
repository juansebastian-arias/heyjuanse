/**
 * The GTM simulator's assumptions. Every number the simulator uses lives in this file, is shown
 * on the site next to the results, and is synthetic: these are planning assumptions for a
 * fictional B2B software company, not data from any employer or client.
 */

export type MotionId = "inbound" | "outbound" | "plg" | "events";

export type AutomationId =
  | "instantRouting"
  | "enrichment"
  | "scoring"
  | "aiDrafts"
  | "dedupe"
  | "signals";

export interface Motion {
  id: MotionId;
  name: string;
  /** One line a visitor can read in a second. */
  short: string;
  /** Leads that arrive over the 90 days. */
  leads: number;
  /** Steady arrivals, or most leads arriving right after three events. */
  arrival: "steady" | "bursts";
  /** Average fit with the ideal customer profile, 0 to 1. */
  fitMean: number;
  /** Average buying intent, 0 to 1. */
  intentMean: number;
  /** Chance that a lead with average fit and intent has a real need right now. */
  needBase: number;
  /** Chance that a lead with a need books a meeting when reached fast with a generic message. */
  baseReply: number;
  /** How much a slow first touch hurts, 0 (not at all) to 1 (a lot). */
  speedSensitivity: number;
  /** Hours from arrival to a rep's first touch when routing is manual. */
  manualRoutingHours: number;
  /** Share of leads that are duplicates of a record already in the CRM. */
  duplicateRate: number;
  /** Share of leads missing company data such as size and industry. */
  missingDataRate: number;
  /** Share of leads that show a buying signal later in the quarter. */
  signalRate: number;
  /** Cost to generate one lead, in US dollars (ads, data, events, partner fees). */
  costPerLead: number;
  /** Share of meetings that become a qualified opportunity. */
  meetingToOpportunity: number;
  /** Average first-year contract value of an opportunity, in US dollars. */
  dealSize: number;
}

export const MOTIONS: Record<MotionId, Motion> = {
  inbound: {
    id: "inbound",
    name: "Inbound",
    short: "Demo requests and content downloads from the website.",
    leads: 1800,
    arrival: "steady",
    fitMean: 0.42,
    intentMean: 0.5,
    needBase: 0.3,
    baseReply: 0.62,
    speedSensitivity: 1,
    manualRoutingHours: 20,
    duplicateRate: 0.14,
    missingDataRate: 0.45,
    signalRate: 0.18,
    costPerLead: 38,
    meetingToOpportunity: 0.48,
    dealSize: 24000,
  },
  outbound: {
    id: "outbound",
    name: "Outbound to target accounts",
    short: "A named list of best-fit companies, reached by email and LinkedIn.",
    leads: 2600,
    arrival: "steady",
    fitMean: 0.62,
    intentMean: 0.16,
    needBase: 0.2,
    baseReply: 0.2,
    speedSensitivity: 0.15,
    manualRoutingHours: 30,
    duplicateRate: 0.09,
    missingDataRate: 0.3,
    signalRate: 0.12,
    costPerLead: 6,
    meetingToOpportunity: 0.42,
    dealSize: 38000,
  },
  plg: {
    id: "plg",
    name: "Product-led",
    short: "Free trial sign-ups; usage shows who is getting value.",
    leads: 3400,
    arrival: "steady",
    fitMean: 0.28,
    intentMean: 0.42,
    needBase: 0.2,
    baseReply: 0.45,
    speedSensitivity: 0.7,
    manualRoutingHours: 26,
    duplicateRate: 0.18,
    missingDataRate: 0.6,
    signalRate: 0.26,
    costPerLead: 9,
    meetingToOpportunity: 0.4,
    dealSize: 14000,
  },
  events: {
    id: "events",
    name: "Events and partners",
    short: "Badge scans from three trade shows and referrals from partners.",
    leads: 1300,
    arrival: "bursts",
    fitMean: 0.5,
    intentMean: 0.38,
    needBase: 0.28,
    baseReply: 0.5,
    speedSensitivity: 0.8,
    manualRoutingHours: 70,
    duplicateRate: 0.22,
    missingDataRate: 0.35,
    signalRate: 0.15,
    costPerLead: 85,
    meetingToOpportunity: 0.5,
    dealSize: 30000,
  },
};

export const MOTION_IDS = Object.keys(MOTIONS) as MotionId[];

export interface Automation {
  id: AutomationId;
  name: string;
  /** What it does, in plain words. */
  what: string;
  /** What it changes in the simulation. */
  effect: string;
  /** Monthly running cost in US dollars, for the cost-per-meeting figure. */
  monthlyCost: number;
}

export const AUTOMATIONS: Record<AutomationId, Automation> = {
  dedupe: {
    id: "dedupe",
    name: "Dedupe and CRM hygiene",
    what: "Merges a new lead into the existing contact and account instead of creating a copy.",
    effect: "Duplicates never reach a rep, so no time is spent on them.",
    monthlyCost: 0,
  },
  enrichment: {
    id: "enrichment",
    name: "Enrichment waterfall",
    what: "Fills company size, industry and role from several data providers, one after another.",
    effect: "Scoring sees the real fit, and reps skip 4 minutes of manual lookup per lead.",
    monthlyCost: 900,
  },
  scoring: {
    id: "scoring",
    name: "Fit and intent scoring",
    what: "Ranks every lead by how well it fits and how ready it looks, and nurtures the low end.",
    effect: "Reps work the best leads first instead of first come, first served.",
    monthlyCost: 0,
  },
  instantRouting: {
    id: "instantRouting",
    name: "Instant routing",
    what: "Assigns each lead to the right rep and alerts them within minutes, day or night.",
    effect: "The first touch no longer waits for someone to sort the inbox.",
    monthlyCost: 50,
  },
  aiDrafts: {
    id: "aiDrafts",
    name: "AI research and drafts, a person approves",
    what: "An AI agent researches the account and drafts the first message; the rep edits and sends.",
    effect: "Messages are more relevant, and a first-touch sequence takes 9 minutes instead of 25.",
    monthlyCost: 400,
  },
  signals: {
    id: "signals",
    name: "Buying-signal triggers",
    what: "Watches for pricing-page visits, usage spikes and job changes on leads that were not ready.",
    effect: "Leads that come back to life go straight back to a rep.",
    monthlyCost: 300,
  },
};

/** Order used everywhere on the site: the order a lead meets them. */
export const AUTOMATION_IDS: AutomationId[] = [
  "dedupe",
  "enrichment",
  "scoring",
  "instantRouting",
  "aiDrafts",
  "signals",
];

export type Automations = Record<AutomationId, boolean>;

export const ALL_ON: Automations = {
  dedupe: true,
  enrichment: true,
  scoring: true,
  instantRouting: true,
  aiDrafts: true,
  signals: true,
};

export const ALL_OFF: Automations = {
  dedupe: false,
  enrichment: false,
  scoring: false,
  instantRouting: false,
  aiDrafts: false,
  signals: false,
};

/** The sales team and the quarter. */
export const TEAM = {
  reps: 3,
  /** Hours per rep per working day for first-touch sequences on new leads. */
  sellingHoursPerDay: 4,
  /** Fully loaded cost of a rep hour, in US dollars. */
  costPerRepHour: 45,
  days: 90,
  /** Minutes to research a lead and write a three-step first-touch sequence by hand. */
  manualMinutes: 25,
  /** Minutes when AI research and drafts are ready and the rep reviews, edits and approves them. */
  aiMinutes: 9,
  /** Extra minutes of manual lookup when company data is missing and nothing enriches it. */
  lookupMinutes: 4,
  /** A lead that waits longer than this many days goes cold and is never worked. */
  staleAfterDays: 10,
  /** With scoring on, leads below this score go to nurture instead of a rep. */
  nurtureBelow: 0.15,
  /** How much better AI-drafted, researched messages perform. */
  aiLift: 1.25,
  /** How much better any message performs when company data is complete. */
  enrichedLift: 1.08,
  /** Chance a lead that shows a buying signal has a real need at that point. */
  signalNeed: 0.4,
  /** How much a nurture email track converts, compared with a rep's first touch. */
  nurtureShare: 0.15,
  /** The working day, in hours. */
  dayStart: 9,
  dayEnd: 18,
} as const;
