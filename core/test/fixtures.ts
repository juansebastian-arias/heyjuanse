/** Helpers for building small, readable test records. */
import type { LeadAiSignals } from "../ai/signals";
import type { Lead } from "../cleaning/pipeline";
import { prepareWeek } from "../cleaning/pipeline";
import type { Company, RawLead } from "../model";

let counter = 0;

export function rawLead(overrides: Partial<RawLead> = {}): RawLead {
  counter++;
  const n = String(counter).padStart(4, "0");
  return {
    rawId: `R-${n}`,
    receivedAt: `2026-10-05T${String(8 + (counter % 10)).padStart(2, "0")}:00:${String(counter % 60).padStart(2, "0")}.000Z`,
    source: "demo_request",
    firstName: "Ana",
    lastName: "Lopez",
    email: `ana.lopez${n}@acme.example`,
    companyName: "Acme Manufacturing",
    website: null,
    country: "United States",
    jobTitle: "Logistics Manager",
    message: null,
    activity: {
      pricingPageViews: 0,
      docsVisits: 0,
      webinarAttended: false,
      emailClicks: 0,
      lastActivityDaysAgo: null,
    },
    ...overrides,
  };
}

export function company(overrides: Partial<Company> = {}): Company {
  return {
    id: "C-001",
    name: "Acme Manufacturing",
    legalSuffix: "Inc.",
    domain: "acme.example",
    industry: "manufacturing",
    sizeBand: "200-999",
    region: "north_america",
    country: "US",
    isCustomer: false,
    isCompetitor: false,
    ...overrides,
  };
}

/** Build leads by running records through the real cleaning pipeline. */
export function leadsFrom(
  rawLeads: RawLead[],
  companies: Company[] = [company()],
  suppressions: string[] = [],
): Lead[] {
  return prepareWeek({ companies, suppressions, rawLeads }).leads;
}

export function leadFrom(
  raw: Partial<RawLead> = {},
  companies?: Company[],
  suppressions?: string[],
): Lead {
  const [lead] = leadsFrom([rawLead(raw)], companies, suppressions);
  if (!lead) throw new Error("Expected one lead");
  return lead;
}

export function signals(overrides: Partial<LeadAiSignals> = {}): LeadAiSignals {
  return {
    intent: "evaluating_solution",
    timeline: "within_30_days",
    budget: "approved",
    nextStep: "demo",
    painPoints: [],
    language: "en",
    injection: false,
    confidence: "high",
    rawIds: [],
    ...overrides,
  };
}
