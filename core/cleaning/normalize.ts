/**
 * Field-level cleaning. Every change is recorded with a plain-language reason, so the case
 * file can show exactly what happened to a record between the form and the rules.
 */
import type { LeadSource, RawLead } from "../model";
import {
  COUNTRY_REFERENCE,
  FREEMAIL_DOMAINS,
  LEGAL_SUFFIXES,
  NICKNAMES,
  TITLE_ACRONYMS,
} from "../reference";
import { squish, stripAccents, titleCaseName } from "../text";

export type CleanField =
  | "firstName"
  | "lastName"
  | "email"
  | "companyName"
  | "website"
  | "country"
  | "jobTitle";

export interface FieldChange {
  field: CleanField;
  from: string | null;
  to: string | null;
  reason: string;
}

export type EmailStatus = "valid" | "invalid" | "missing";

export interface CleanRecord {
  rawId: string;
  receivedAt: string;
  source: LeadSource;
  firstName: string | null;
  lastName: string | null;
  /** Lowercase and trimmed. Null when missing or invalid. */
  email: string | null;
  /** The email used for matching: lowercase, with any "+tag" removed. */
  emailKey: string | null;
  emailDomain: string | null;
  emailStatus: EmailStatus;
  isFreemail: boolean;
  companyName: string | null;
  /** Company name for comparison: lowercase, no accents, punctuation or legal suffix. */
  companyKey: string | null;
  websiteDomain: string | null;
  /** ISO 3166-1 alpha-2 code, when the typed country was recognised. */
  country: string | null;
  jobTitle: string | null;
  message: string | null;
  activity: RawLead["activity"];
  changes: FieldChange[];
}

const EMAIL_PATTERN =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const FREEMAIL = new Set<string>(FREEMAIL_DOMAINS);

export function isFreemailDomain(domain: string | null): boolean {
  return domain !== null && FREEMAIL.has(domain);
}

/** Trim and collapse spaces. Returns null for empty strings. */
function tidy(value: string | null): string | null {
  if (value === null) return null;
  const result = squish(value);
  return result.length > 0 ? result : null;
}

export function normalizeName(
  value: string | null,
  field: "firstName" | "lastName",
  changes: FieldChange[],
): string | null {
  const tidied = tidy(value);
  if (tidied === null) {
    if (field === "lastName") {
      changes.push({ field, from: value, to: null, reason: "Last name missing" });
    }
    return null;
  }
  const isAllLower = tidied === tidied.toLowerCase();
  const isAllUpper = tidied === tidied.toUpperCase() && /\p{L}{2,}/u.test(tidied);
  const result = isAllLower || isAllUpper ? titleCaseName(tidied) : tidied;
  if (result !== value) {
    const reason =
      isAllLower || isAllUpper
        ? "Capitalization fixed"
        : tidied !== value
          ? "Extra spaces removed"
          : "Name tidied";
    changes.push({ field, from: value, to: result, reason });
  }
  return result;
}

export interface EmailResult {
  email: string | null;
  emailKey: string | null;
  domain: string | null;
  status: EmailStatus;
}

export function normalizeEmail(value: string | null, changes: FieldChange[]): EmailResult {
  const tidied = tidy(value);
  if (tidied === null) {
    changes.push({ field: "email", from: value, to: null, reason: "Email missing" });
    return { email: null, emailKey: null, domain: null, status: "missing" };
  }
  const lower = tidied.toLowerCase();
  if (!EMAIL_PATTERN.test(lower)) {
    changes.push({ field: "email", from: value, to: null, reason: "Not a valid email address" });
    return { email: null, emailKey: null, domain: null, status: "invalid" };
  }
  if (lower !== value) {
    changes.push({ field: "email", from: value, to: lower, reason: "Email lowercased" });
  }
  const [local = "", domain = ""] = lower.split("@");
  const plusIndex = local.indexOf("+");
  const key = plusIndex >= 0 ? `${local.slice(0, plusIndex)}@${domain}` : lower;
  return { email: lower, emailKey: key, domain, status: "valid" };
}

export function companyKey(value: string | null): string | null {
  if (value === null) return null;
  let key = stripAccents(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  for (const suffix of LEGAL_SUFFIXES) {
    if (key.endsWith(` ${suffix}`)) {
      key = key.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }
  return key.length > 0 ? key : null;
}

export function normalizeCompany(
  value: string | null,
  changes: FieldChange[],
): { name: string | null; key: string | null } {
  const tidied = tidy(value);
  if (tidied === null) return { name: null, key: null };
  if (tidied !== value) {
    changes.push({ field: "companyName", from: value, to: tidied, reason: "Extra spaces removed" });
  }
  return { name: tidied, key: companyKey(tidied) };
}

export function normalizeWebsite(value: string | null, changes: FieldChange[]): string | null {
  const tidied = tidy(value);
  if (tidied === null) return null;
  const domain = tidied
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    changes.push({ field: "website", from: value, to: null, reason: "Website not recognised" });
    return null;
  }
  if (domain !== value) {
    changes.push({
      field: "website",
      from: value,
      to: domain,
      reason: "Website reduced to its domain",
    });
  }
  return domain;
}

const COUNTRY_BY_ALIAS = new Map<string, string>();
for (const country of COUNTRY_REFERENCE) {
  for (const alias of country.aliases) COUNTRY_BY_ALIAS.set(alias, country.code);
  COUNTRY_BY_ALIAS.set(country.code.toLowerCase(), country.code);
}

export function countryAliasKey(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export function normalizeCountry(value: string | null, changes: FieldChange[]): string | null {
  const tidied = tidy(value);
  if (tidied === null) return null;
  const code = COUNTRY_BY_ALIAS.get(countryAliasKey(tidied)) ?? null;
  if (code === null) {
    changes.push({ field: "country", from: value, to: null, reason: "Country not recognised" });
    return null;
  }
  const canonical = COUNTRY_REFERENCE.find((country) => country.code === code)?.name;
  if (value !== code && value !== canonical) {
    changes.push({ field: "country", from: value, to: code, reason: "Country standardized" });
  }
  return code;
}

const ACRONYMS = new Set(TITLE_ACRONYMS);

export function normalizeTitle(value: string | null, changes: FieldChange[]): string | null {
  const tidied = tidy(value);
  if (tidied === null) return null;
  let result = tidied;
  if (tidied === tidied.toLowerCase()) {
    result = tidied
      .split(" ")
      .map((word) => {
        if (ACRONYMS.has(word)) return word.toUpperCase();
        if (["of", "and", "de", "y", "e", "da", "do"].includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
  if (result !== value) {
    changes.push({
      field: "jobTitle",
      from: value,
      to: result,
      reason: result === tidied ? "Extra spaces removed" : "Capitalization fixed",
    });
  }
  return result;
}

/** Lowercase, accent-free first name with nicknames mapped to the formal name. */
export function canonicalFirstName(value: string | null): string | null {
  if (value === null) return null;
  const key = stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (key.length === 0) return null;
  return NICKNAMES[key] ?? key;
}

/** Lowercase, accent-free last name with spaces and punctuation removed. */
export function lastNameKey(value: string | null): string | null {
  if (value === null) return null;
  const key = stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return key.length > 0 ? key : null;
}

export function titleKey(value: string | null): string | null {
  if (value === null) return null;
  const key = stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return key.length > 0 ? key : null;
}

export function cleanRecord(raw: RawLead): CleanRecord {
  const changes: FieldChange[] = [];
  const firstName = normalizeName(raw.firstName, "firstName", changes);
  const lastName = normalizeName(raw.lastName, "lastName", changes);
  const email = normalizeEmail(raw.email, changes);
  const company = normalizeCompany(raw.companyName, changes);
  const websiteDomain = normalizeWebsite(raw.website, changes);
  const country = normalizeCountry(raw.country, changes);
  const jobTitle = normalizeTitle(raw.jobTitle, changes);
  const message = tidy(raw.message);
  return {
    rawId: raw.rawId,
    receivedAt: raw.receivedAt,
    source: raw.source,
    firstName,
    lastName,
    email: email.email,
    emailKey: email.emailKey,
    emailDomain: email.domain,
    emailStatus: email.status,
    isFreemail: isFreemailDomain(email.domain),
    companyName: company.name,
    companyKey: company.key,
    websiteDomain,
    country,
    jobTitle,
    message,
    activity: raw.activity,
    changes,
  };
}
