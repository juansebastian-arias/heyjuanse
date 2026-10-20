/**
 * From raw CRM records to one lead per person: clean each record, find duplicates, merge them
 * with explicit survivorship rules, then enrich. Nothing here depends on the dials, so it runs
 * once per week of data.
 */
import type { Company, LeadSource, RawLead, Region } from "../model";
import { type DedupeResult, type DuplicateFlag, dedupe, type MergeLink } from "./dedupe";
import { buildProviderIndex, type CompanyMatch, matchCompany, regionForCountry } from "./enrich";
import { type CleanRecord, cleanRecord, type EmailStatus, type FieldChange } from "./normalize";

export interface LeadMessage {
  rawId: string;
  receivedAt: string;
  text: string;
}

/** Which raw record supplied a merged field, and why. */
export interface SurvivorshipNote {
  field: "name" | "email" | "company" | "website" | "country" | "jobTitle" | "activity";
  rawId: string | null;
  rule: string;
}

/** How a merged lead picks each field from its submissions. Published on the site as written. */
export const SURVIVORSHIP_RULES: Record<SurvivorshipNote["field"], string> = {
  name: "Most recent submission with a full name",
  email: "Earliest valid company email, else earliest valid email",
  company: "Most recent non-empty value",
  website: "Most recent non-empty value",
  jobTitle: "Most recent non-empty value",
  country: "Most recent non-empty value",
  activity: "Highest count across submissions; most recent activity date",
};

export interface Lead {
  leadId: string;
  /** In arrival order. */
  rawIds: string[];
  firstTouchAt: string;
  lastTouchAt: string;
  /** One per submission, in arrival order. */
  sources: LeadSource[];
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailDomain: string | null;
  emailStatus: EmailStatus;
  isFreemail: boolean;
  /** Every valid email key across the lead's submissions, for suppression checks. */
  emailKeys: string[];
  companyName: string | null;
  websiteDomain: string | null;
  /** ISO code, typed by the person or filled from the matched company. */
  country: string | null;
  countryFilledFromCompany: boolean;
  region: Region | null;
  jobTitle: string | null;
  messages: LeadMessage[];
  activity: RawLead["activity"];
  match: CompanyMatch | null;
  suppressed: boolean;
  merges: MergeLink[];
  flags: DuplicateFlag[];
  survivorship: SurvivorshipNote[];
  /** Field fixes from cleaning, per raw record. */
  changes: Array<FieldChange & { rawId: string }>;
}

export interface PreparedWeek {
  records: CleanRecord[];
  dedupe: DedupeResult;
  leads: Lead[];
}

/** The most recent record with a value for this field. */
function latest<T>(
  records: CleanRecord[],
  pick: (record: CleanRecord) => T | null,
): { value: T | null; rawId: string | null } {
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    if (!record) continue;
    const value = pick(record);
    if (value !== null) return { value, rawId: record.rawId };
  }
  return { value: null, rawId: null };
}

function mergeActivity(records: CleanRecord[]): RawLead["activity"] {
  const recency = records
    .map((record) => record.activity.lastActivityDaysAgo)
    .filter((value): value is number => value !== null);
  return {
    pricingPageViews: Math.max(0, ...records.map((r) => r.activity.pricingPageViews)),
    docsVisits: Math.max(0, ...records.map((r) => r.activity.docsVisits)),
    webinarAttended: records.some((r) => r.activity.webinarAttended),
    emailClicks: Math.max(0, ...records.map((r) => r.activity.emailClicks)),
    lastActivityDaysAgo: recency.length > 0 ? Math.min(...recency) : null,
  };
}

export function leadIdFor(firstRawId: string): string {
  return `L-${firstRawId.replace(/^R-/, "")}`;
}

function buildLead(
  records: CleanRecord[],
  dedupeResult: DedupeResult,
  index: ReturnType<typeof buildProviderIndex>,
  suppressions: Set<string>,
): Lead {
  const first = records[0];
  const last = records[records.length - 1];
  if (!first || !last) throw new Error("A lead needs at least one record");
  const ids = new Set(records.map((record) => record.rawId));
  const survivorship: SurvivorshipNote[] = [];
  const multi = records.length > 1;

  // Name: the most recent record with a full name, else the most recent first name.
  const fullName = latest(records, (r) => (r.firstName && r.lastName ? r : null));
  const nameSource = fullName.value ?? latest(records, (r) => (r.firstName ? r : null)).value;
  if (multi) {
    survivorship.push({
      field: "name",
      rawId: nameSource?.rawId ?? null,
      rule: SURVIVORSHIP_RULES.name,
    });
  }

  // Email: the earliest valid company email, else the earliest valid email.
  const valid = records.filter((r) => r.emailStatus === "valid");
  const corporate = valid.find((r) => !r.isFreemail);
  const emailRecord = corporate ?? valid[0] ?? null;
  if (multi) {
    survivorship.push({
      field: "email",
      rawId: emailRecord?.rawId ?? null,
      rule: SURVIVORSHIP_RULES.email,
    });
  }

  const company = latest(records, (r) => r.companyName);
  const website = latest(records, (r) => r.websiteDomain);
  const title = latest(records, (r) => r.jobTitle);
  const typedCountry = latest(records, (r) => r.country);
  if (multi) {
    survivorship.push(
      { field: "company", rawId: company.rawId, rule: SURVIVORSHIP_RULES.company },
      { field: "website", rawId: website.rawId, rule: SURVIVORSHIP_RULES.website },
      { field: "jobTitle", rawId: title.rawId, rule: SURVIVORSHIP_RULES.jobTitle },
      { field: "country", rawId: typedCountry.rawId, rule: SURVIVORSHIP_RULES.country },
      { field: "activity", rawId: null, rule: SURVIVORSHIP_RULES.activity },
    );
  }

  const match = matchCompany(
    {
      emailDomains: valid
        .filter((r) => !r.isFreemail && r.emailDomain)
        .map((r) => r.emailDomain as string),
      websiteDomains: records.map((r) => r.websiteDomain).filter((d): d is string => d !== null),
      companyKeys: records.map((r) => r.companyKey).filter((k): k is string => k !== null),
    },
    index,
  );

  const providerCompany: Company | null = match?.company ?? null;
  const country = typedCountry.value ?? providerCompany?.country ?? null;
  const emailKeys = [
    ...new Set(valid.map((r) => r.emailKey).filter((k): k is string => k !== null)),
  ];
  const emailStatus: EmailStatus =
    valid.length > 0
      ? "valid"
      : records.some((r) => r.emailStatus === "invalid")
        ? "invalid"
        : "missing";

  return {
    leadId: leadIdFor(first.rawId),
    rawIds: records.map((r) => r.rawId),
    firstTouchAt: first.receivedAt,
    lastTouchAt: last.receivedAt,
    sources: records.map((r) => r.source),
    firstName: nameSource?.firstName ?? null,
    lastName: nameSource?.lastName ?? null,
    email: emailRecord?.email ?? null,
    emailDomain: emailRecord?.emailDomain ?? null,
    emailStatus,
    isFreemail: emailRecord ? emailRecord.isFreemail : false,
    emailKeys,
    companyName: company.value,
    websiteDomain: website.value,
    country,
    countryFilledFromCompany: typedCountry.value === null && country !== null,
    region: providerCompany?.region ?? regionForCountry(country),
    jobTitle: title.value,
    messages: records
      .filter((r) => r.message !== null)
      .map((r) => ({ rawId: r.rawId, receivedAt: r.receivedAt, text: r.message as string })),
    activity: mergeActivity(records),
    match,
    suppressed: emailKeys.some((key) => suppressions.has(key)),
    merges: dedupeResult.links.filter((link) => ids.has(link.a) || ids.has(link.b)),
    flags: dedupeResult.flags.filter((flag) => ids.has(flag.a) || ids.has(flag.b)),
    survivorship,
    changes: records.flatMap((r) => r.changes.map((change) => ({ ...change, rawId: r.rawId }))),
  };
}

export interface WeekInput {
  companies: Company[];
  suppressions: string[];
  rawLeads: RawLead[];
}

export function prepareWeek(input: WeekInput): PreparedWeek {
  const records = input.rawLeads.map(cleanRecord);
  const byId = new Map(records.map((record) => [record.rawId, record]));
  const dedupeResult = dedupe(records);
  const index = buildProviderIndex(input.companies);
  const suppressions = new Set(input.suppressions.map((email) => email.toLowerCase()));
  const leads = dedupeResult.groups.map((group) =>
    buildLead(
      group.map((id) => {
        const record = byId.get(id);
        if (!record) throw new Error(`Missing record ${id}`);
        return record;
      }),
      dedupeResult,
      index,
      suppressions,
    ),
  );
  return { records, dedupe: dedupeResult, leads };
}
