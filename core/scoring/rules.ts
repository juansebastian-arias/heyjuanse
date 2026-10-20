/**
 * The scoring rules, as data. The site renders these tables directly, so what you read on the
 * "Under the hood" page is what the code runs.
 *
 * A score has three groups:
 *   Fit     (0 to 40)   Is this the kind of company Larkspur serves?
 *   Intent  (0 to 40)   Is this person acting like a buyer right now?
 *   AI      (-10 to 25) What the message says, if the AI policy allows it.
 * The final score is clamped to 0..100.
 */
import type {
  Budget,
  Industry,
  Intent,
  LeadSource,
  NextStep,
  Region,
  SizeBand,
  Timeline,
} from "../model";

export const FIT_POINTS = {
  industry: {
    manufacturing: 15,
    retail_ecommerce: 15,
    third_party_logistics: 12,
    freight_forwarding: 10,
    freight_brokerage: 6,
    carrier: 3,
    other: 0,
    unknown: 5,
  } satisfies Record<Industry | "unknown", number>,
  size: {
    "1-49": 2,
    "50-199": 8,
    "200-999": 15,
    "1000-4999": 13,
    "5000+": 9,
    unknown: 5,
  } satisfies Record<SizeBand | "unknown", number>,
  region: {
    north_america: 10,
    latin_america: 9,
    europe: 6,
    asia_pacific: 3,
    unknown: 4,
  } satisfies Record<Region | "unknown", number>,
} as const;

export const INTENT_POINTS = {
  /** The strongest source across the lead's submissions counts. */
  source: {
    demo_request: 20,
    pricing_contact: 16,
    partner_referral: 14,
    chat: 10,
    trade_show: 8,
    webinar: 6,
    content_download: 3,
  } satisfies Record<LeadSource, number>,
  behavior: {
    pricingViewsTwoOrMore: 8,
    pricingViewsOne: 4,
    docsVisitsThreeOrMore: 4,
    webinarAttended: 3,
    emailClicksTwoOrMore: 2,
    cap: 15,
  },
  recency: {
    withinThreeDays: 5,
    withinSevenDays: 3,
  },
} as const;

export const AI_POINTS = {
  intent: { evaluating_solution: 6 } satisfies Partial<Record<Intent, number>>,
  timeline: {
    within_30_days: 10,
    one_to_three_months: 6,
    over_three_months: -2,
  } satisfies Partial<Record<Timeline, number>>,
  budget: { approved: 6, in_planning: 2, constrained: -6 } satisfies Partial<
    Record<Budget, number>
  >,
  nextStep: { demo: 4, pricing: 3, call: 2 } satisfies Partial<Record<NextStep, number>>,
  min: -10,
  max: 25,
} as const;

export const GROUP_LIMITS = {
  fit: { min: 0, max: 40 },
  intent: { min: 0, max: 40 },
  ai: { min: AI_POINTS.min, max: AI_POINTS.max },
} as const;
