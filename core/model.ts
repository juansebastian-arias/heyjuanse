/**
 * Domain model for the Decision Lab.
 *
 * Larkspur is a fictional company that sells freight-operations software (carrier
 * tendering, shipment visibility, freight audit) to shippers and logistics providers.
 * Every company, person and message in this project is synthetic.
 */

export const INDUSTRIES = [
  "manufacturing",
  "retail_ecommerce",
  "third_party_logistics",
  "freight_forwarding",
  "freight_brokerage",
  "carrier",
  "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  manufacturing: "Manufacturing",
  retail_ecommerce: "Retail and e-commerce",
  third_party_logistics: "Third-party logistics",
  freight_forwarding: "Freight forwarding",
  freight_brokerage: "Freight brokerage",
  carrier: "Carrier",
  other: "Other",
};

export const SIZE_BANDS = ["1-49", "50-199", "200-999", "1000-4999", "5000+"] as const;
export type SizeBand = (typeof SIZE_BANDS)[number];

export const SIZE_LABELS: Record<SizeBand, string> = {
  "1-49": "1–49 employees",
  "50-199": "50–199 employees",
  "200-999": "200–999 employees",
  "1000-4999": "1,000–4,999 employees",
  "5000+": "5,000+ employees",
};

export const REGIONS = ["north_america", "latin_america", "europe", "asia_pacific"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  north_america: "North America",
  latin_america: "Latin America",
  europe: "Europe",
  asia_pacific: "Asia Pacific",
};

export const LEAD_SOURCES = [
  "demo_request",
  "pricing_contact",
  "chat",
  "partner_referral",
  "trade_show",
  "webinar",
  "content_download",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  demo_request: "Demo request form",
  pricing_contact: "Pricing contact form",
  chat: "Website chat",
  partner_referral: "Partner referral",
  trade_show: "Trade show badge scan",
  webinar: "Webinar registration",
  content_download: "Guide download",
};

/** Who the person really is. Hidden from the rules; used only to generate data and to evaluate. */
export const PERSONAS = [
  "buyer",
  "existing_customer",
  "vendor",
  "job_seeker",
  "student",
  "competitor",
  "spam",
] as const;
export type Persona = (typeof PERSONAS)[number];

export const BUYER_STAGES = ["active_evaluation", "problem_aware", "researching"] as const;
export type BuyerStage = (typeof BUYER_STAGES)[number];

// ---------------------------------------------------------------------------
// Message signals. The same vocabulary is used to annotate synthetic messages
// and as the output contract of the AI extraction step.
// ---------------------------------------------------------------------------

export const INTENTS = [
  "evaluating_solution",
  "general_interest",
  "existing_customer_support",
  "vendor_or_partner_pitch",
  "job_inquiry",
  "student_or_research",
  "spam",
  "unclear",
] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  evaluating_solution: "Evaluating a solution",
  general_interest: "General interest",
  existing_customer_support: "Existing customer request",
  vendor_or_partner_pitch: "Vendor or partner pitch",
  job_inquiry: "Job inquiry",
  student_or_research: "Student or research",
  spam: "Spam",
  unclear: "Unclear",
};

export const TIMELINES = [
  "within_30_days",
  "one_to_three_months",
  "over_three_months",
  "not_stated",
] as const;
export type Timeline = (typeof TIMELINES)[number];

export const TIMELINE_LABELS: Record<Timeline, string> = {
  within_30_days: "Within 30 days",
  one_to_three_months: "In 1–3 months",
  over_three_months: "In more than 3 months",
  not_stated: "Not stated",
};

export const BUDGETS = ["approved", "in_planning", "constrained", "not_mentioned"] as const;
export type Budget = (typeof BUDGETS)[number];

export const BUDGET_LABELS: Record<Budget, string> = {
  approved: "Approved",
  in_planning: "Being planned",
  constrained: "Constrained or frozen",
  not_mentioned: "Not mentioned",
};

export const NEXT_STEPS = ["demo", "pricing", "call", "information", "none"] as const;
export type NextStep = (typeof NEXT_STEPS)[number];

export const NEXT_STEP_LABELS: Record<NextStep, string> = {
  demo: "Demo",
  pricing: "Pricing",
  call: "Call",
  information: "Information",
  none: "None",
};

export const PAIN_POINTS = [
  "shipment_visibility",
  "carrier_management",
  "freight_audit",
  "manual_processes",
  "integration",
  "cost_control",
] as const;
export type PainPoint = (typeof PAIN_POINTS)[number];

export const PAIN_POINT_LABELS: Record<PainPoint, string> = {
  shipment_visibility: "Shipment visibility",
  carrier_management: "Carrier management",
  freight_audit: "Freight audit",
  manual_processes: "Manual processes",
  integration: "Integration",
  cost_control: "Cost control",
};

export const LANGUAGES = ["en", "es", "pt", "other"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  other: "Other",
};

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** What a message actually says. Used as ground truth for synthetic messages. */
export interface MessageSignals {
  intent: Intent;
  timeline: Timeline;
  budget: Budget;
  nextStep: NextStep;
  painPoints: PainPoint[];
  language: Language;
  /** The message tries to instruct an automated reader (for example "ignore your rules"). */
  injection: boolean;
}

/** Other answers a careful human reviewer would also accept for an ambiguous message. */
export type AcceptableAlternatives = Partial<{
  intent: Intent[];
  timeline: Timeline[];
  budget: Budget[];
  nextStep: NextStep[];
  language: Language[];
}>;

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/** A company as known to the (simulated) firmographic data provider. */
export interface Company {
  id: string;
  name: string;
  legalSuffix: string | null;
  domain: string;
  industry: Industry;
  sizeBand: SizeBand;
  region: Region;
  /** ISO 3166-1 alpha-2 code. */
  country: string;
  isCustomer: boolean;
  isCompetitor: boolean;
}

/** A lead exactly as it arrived in the CRM, defects included. */
export interface RawLead {
  rawId: string;
  /** ISO 8601 timestamp, UTC. */
  receivedAt: string;
  source: LeadSource;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  companyName: string | null;
  website: string | null;
  country: string | null;
  jobTitle: string | null;
  message: string | null;
  /** Web activity linked to this submission over the previous 30 days. */
  activity: {
    pricingPageViews: number;
    docsVisits: number;
    webinarAttended: boolean;
    emailClicks: number;
    /** Days since the most recent activity, or null when there is none. */
    lastActivityDaysAgo: number | null;
  };
}

/** Ground truth about one real person behind one or more raw leads. Never used by the rules. */
export interface PersonTruth {
  personId: string;
  rawIds: string[];
  companyId: string | null;
  persona: Persona;
  stage: BuyerStage | null;
  /** Would a sales conversation this week find a real, qualified new-business need? */
  hasNeed: boolean;
}

/** Ground truth for one raw lead's message. */
export interface MessageTruth {
  rawId: string;
  templateId: string;
  signals: MessageSignals;
  accept: AcceptableAlternatives;
}

export interface Dataset {
  id: string;
  label: string;
  seed: number;
  /** Bumped whenever generator logic changes, so stored AI outputs can be checked against it. */
  generatorVersion: number;
  weekStart: string;
  weekEnd: string;
  companies: Company[];
  rawLeads: RawLead[];
  /** Emails on the marketing suppression list (people who opted out). */
  suppressions: string[];
  truth: {
    people: PersonTruth[];
    messages: MessageTruth[];
  };
}
