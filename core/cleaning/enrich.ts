/**
 * Enrichment: match a lead to the firmographic provider's company list, the way a CRM
 * enrichment tool would. Matching is exact and conservative. A typo in a company name is not
 * guessed at; the lead keeps "unknown" firmographics and the score reflects that.
 */
import type { Company, Region } from "../model";
import { COUNTRY_REFERENCE } from "../reference";
import { companyKey } from "./normalize";

export type MatchMethod = "email_domain" | "website" | "company_name";

export interface CompanyMatch {
  company: Company;
  method: MatchMethod;
  /** The value that matched, for the case file. */
  value: string;
}

export interface ProviderIndex {
  byDomain: Map<string, Company>;
  /** Only names that identify exactly one company. */
  byNameKey: Map<string, Company>;
}

export const MATCH_METHOD_LABELS: Record<MatchMethod, string> = {
  email_domain: "Email domain",
  website: "Website",
  company_name: "Exact company name",
};

export function buildProviderIndex(companies: Company[]): ProviderIndex {
  const byDomain = new Map<string, Company>();
  const nameCounts = new Map<string, number>();
  const byName = new Map<string, Company>();
  for (const company of companies) {
    byDomain.set(company.domain, company);
    const key = companyKey(company.name);
    if (!key) continue;
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    byName.set(key, company);
  }
  const byNameKey = new Map<string, Company>();
  for (const [key, company] of byName) {
    if (nameCounts.get(key) === 1) byNameKey.set(key, company);
  }
  return { byDomain, byNameKey };
}

export interface MatchInput {
  emailDomains: string[];
  websiteDomains: string[];
  companyKeys: string[];
}

export function matchCompany(input: MatchInput, index: ProviderIndex): CompanyMatch | null {
  for (const domain of input.emailDomains) {
    const company = index.byDomain.get(domain);
    if (company) return { company, method: "email_domain", value: domain };
  }
  for (const domain of input.websiteDomains) {
    const company = index.byDomain.get(domain);
    if (company) return { company, method: "website", value: domain };
  }
  for (const key of input.companyKeys) {
    const company = index.byNameKey.get(key);
    if (company) return { company, method: "company_name", value: key };
  }
  return null;
}

const REGION_BY_COUNTRY = new Map<string, Region>(
  COUNTRY_REFERENCE.map((country) => [country.code, country.region]),
);

export function regionForCountry(code: string | null): Region | null {
  return code ? (REGION_BY_COUNTRY.get(code) ?? null) : null;
}

export function countryName(code: string | null): string | null {
  if (!code) return null;
  return COUNTRY_REFERENCE.find((country) => country.code === code)?.name ?? code;
}
