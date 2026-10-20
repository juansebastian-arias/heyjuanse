/**
 * Synthetic data generator for Larkspur's inbound leads.
 *
 * The generator first decides the hidden truth about each person (who they are, how far
 * along a purchase they are, and whether they have a real need), then renders the messy
 * records that a CRM would actually receive: inconsistent casing, typed company names,
 * free-text countries, duplicate submissions, missing fields and the occasional invalid
 * email. The rules engine only ever sees the messy records.
 *
 * Every assumption lives in the ASSUMPTIONS object below, which the site also publishes.
 */
import type {
  BuyerStage,
  Company,
  Dataset,
  Industry,
  LeadSource,
  MessageTruth,
  Persona,
  PersonTruth,
  RawLead,
  SizeBand,
} from "../model";
import { createRng, type Rng } from "../random";
import { slugify, stripAccents } from "../text";
import {
  BUYER_TITLES,
  COMPETITORS,
  COUNTRIES,
  COUNTRY_WEIGHTS_BY_REGION,
  type CountryInfo,
  CURRENT_TOOLS,
  FIRST_NAMES,
  FREEMAIL_DOMAINS,
  INDUSTRY_NOUNS,
  LAST_NAMES,
  LOOKALIKE_FIRST_NAMES,
  type Locale,
  NAME_STEMS,
  NICKNAME_FOR,
  OTHER_TITLES,
} from "./catalog";
import { type Channel, MESSAGE_TEMPLATES, type MessageTemplate } from "./messages";
import { COMPANY_UNIVERSE_SEED, type WeekSpec } from "./weeks";

/** Bump when generator logic changes. Stored AI outputs record the version they were made for. */
export const GENERATOR_VERSION = 1;
export const RAW_LEADS_PER_WEEK = 400;

/** The assumptions behind the synthetic data, published on the site as written here. */
export const ASSUMPTIONS = {
  companyCount: 240,
  companyRegionWeights: { north_america: 45, latin_america: 30, europe: 17, asia_pacific: 8 },
  companyIndustryWeights: {
    manufacturing: 30,
    retail_ecommerce: 22,
    third_party_logistics: 18,
    freight_forwarding: 10,
    freight_brokerage: 7,
    carrier: 8,
    other: 5,
  } satisfies Record<Industry, number>,
  companySizeWeights: {
    "1-49": 16,
    "50-199": 28,
    "200-999": 30,
    "1000-4999": 19,
    "5000+": 7,
  } satisfies Record<SizeBand, number>,
  personaWeights: {
    buyer: 77,
    existing_customer: 6,
    vendor: 5,
    job_seeker: 3,
    student: 3,
    competitor: 2,
    spam: 4,
  } satisfies Record<Persona, number>,
  buyerStageWeights: { active_evaluation: 22, problem_aware: 33, researching: 45 } satisfies Record<
    BuyerStage,
    number
  >,
  /** Probability that a buyer at this stage has a real need, before fit adjustments. */
  needRateByStage: {
    active_evaluation: 0.85,
    problem_aware: 0.42,
    researching: 0.08,
  } satisfies Record<BuyerStage, number>,
  /** Multipliers on the need rate. Larkspur sells best to mid-size shippers in the Americas. */
  needFitMultipliers: {
    size: {
      "1-49": 0.35,
      "50-199": 0.8,
      "200-999": 1,
      "1000-4999": 1,
      "5000+": 0.85,
    } satisfies Record<SizeBand, number>,
    unknownCompany: 0.45,
    industry: {
      manufacturing: 1,
      retail_ecommerce: 1,
      third_party_logistics: 1,
      freight_forwarding: 1,
      freight_brokerage: 0.7,
      carrier: 0.4,
      other: 0.4,
    } satisfies Record<Industry, number>,
    asiaPacific: 0.6,
  },
  /** How a buyer reaches Larkspur depends on how far along they are. */
  sourceWeightsByStage: {
    active_evaluation: {
      demo_request: 40,
      pricing_contact: 25,
      chat: 10,
      partner_referral: 10,
      trade_show: 5,
      webinar: 5,
      content_download: 5,
    },
    problem_aware: {
      demo_request: 15,
      pricing_contact: 15,
      chat: 15,
      partner_referral: 8,
      trade_show: 12,
      webinar: 20,
      content_download: 15,
    },
    researching: {
      demo_request: 5,
      pricing_contact: 5,
      chat: 10,
      partner_referral: 3,
      trade_show: 15,
      webinar: 27,
      content_download: 35,
    },
  } satisfies Record<BuyerStage, Record<LeadSource, number>>,
  /** Probability that a submission from this source includes free text. */
  messageRateBySource: {
    demo_request: 0.85,
    pricing_contact: 0.8,
    chat: 1,
    partner_referral: 0.9,
    trade_show: 0.3,
    webinar: 0.18,
    content_download: 0.08,
  } satisfies Record<LeadSource, number>,
  duplicateSubmissionRate: 0.11,
  injectionRate: 0.015,
  suppressionRate: 0.03,
  defects: {
    nameLowercase: 0.08,
    nameUppercase: 0.03,
    nameExtraWhitespace: 0.04,
    lastNameMissing: 0.02,
    emailMixedCase: 0.08,
    emailPlusTag: 0.025,
    emailInvalid: 0.015,
    companyMissing: 0.13,
    countryMissing: 0.12,
    titleMissing: 0.15,
  },
} as const;

const PERSONA_SOURCE_WEIGHTS: Record<Exclude<Persona, "buyer">, Record<LeadSource, number>> = {
  existing_customer: {
    demo_request: 20,
    pricing_contact: 20,
    chat: 60,
    partner_referral: 0,
    trade_show: 0,
    webinar: 0,
    content_download: 0,
  },
  vendor: {
    demo_request: 30,
    pricing_contact: 10,
    chat: 40,
    partner_referral: 0,
    trade_show: 10,
    webinar: 0,
    content_download: 10,
  },
  job_seeker: {
    demo_request: 20,
    pricing_contact: 0,
    chat: 50,
    partner_referral: 0,
    trade_show: 0,
    webinar: 0,
    content_download: 30,
  },
  student: {
    demo_request: 0,
    pricing_contact: 0,
    chat: 20,
    partner_referral: 0,
    trade_show: 10,
    webinar: 20,
    content_download: 50,
  },
  competitor: {
    demo_request: 0,
    pricing_contact: 20,
    chat: 0,
    partner_referral: 0,
    trade_show: 0,
    webinar: 40,
    content_download: 40,
  },
  spam: {
    demo_request: 30,
    pricing_contact: 20,
    chat: 50,
    partner_referral: 0,
    trade_show: 0,
    webinar: 0,
    content_download: 0,
  },
};

const CHANNEL_BY_SOURCE: Record<LeadSource, Channel> = {
  demo_request: "form",
  pricing_contact: "form",
  chat: "form",
  content_download: "form",
  partner_referral: "referral",
  trade_show: "booth",
  webinar: "webinar",
};

const VENDOR_COMPANIES = [
  { name: "Growthrocket SEO", domain: "growthrocket-seo.example" },
  { name: "LeadForge Agency", domain: "leadforge.example" },
  { name: "Nearshore Devs", domain: "nearshoredevs.example" },
  { name: "RackPro Shelving", domain: "rackpro.example" },
  { name: "IntegrateHub", domain: "integratehub.example" },
  { name: "Distribuidora Aliada", domain: "aliada-dist.example" },
];

const UNIVERSITIES = [
  { name: "Universidad del Valle Central", domain: "uvc.example" },
  { name: "Northgate University", domain: "northgate-u.example" },
  { name: "Universidade Serra Verde", domain: "userraverde.example" },
];

const VOLUMES: Record<"en" | "es" | "pt", string[]> = {
  en: [
    "600 shipments a month",
    "1,200 shipments a month",
    "2,000 loads a month",
    "350 loads a week",
    "4,500 shipments a month",
    "800 loads a month",
  ],
  es: ["800 envíos al mes", "1.500 envíos al mes", "2.000 cargas al mes"],
  pt: ["1.200 cargas por mês", "900 embarques por mês"],
};

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function countryInfo(code: string): CountryInfo {
  const info = COUNTRIES.find((country) => country.code === code);
  if (!info) throw new Error(`Unknown country ${code}`);
  return info;
}

function textLang(locale: Locale): "en" | "es" | "pt" {
  return locale === "es" || locale === "pt" ? locale : "en";
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

function companyName(r: Rng, country: CountryInfo, industry: Industry): string {
  const lang = textLang(country.locale);
  if (lang === "es") return `${r.pick(INDUSTRY_NOUNS[industry].es)} ${r.pick(NAME_STEMS.es)}`;
  if (lang === "pt") return `${r.pick(INDUSTRY_NOUNS[industry].pt)} ${r.pick(NAME_STEMS.pt)}`;
  const stems = ["de", "nl", "fr"].includes(country.locale) ? NAME_STEMS.eu : NAME_STEMS.en;
  return `${r.pick(stems)} ${r.pick(INDUSTRY_NOUNS[industry].en)}`;
}

function uniqueDomain(r: Rng, name: string, used: Set<string>): string {
  const slug = slugify(name);
  const firstWord = slug.split("-")[0] ?? slug;
  const style = r.weighted({ full: 65, first: 20, compact: 15 });
  const preferred =
    style === "full" ? slug : style === "first" ? firstWord : slug.replace(/-/g, "");
  const candidates = [preferred, slug, slug.replace(/-/g, "")];
  for (const candidate of candidates) {
    const domain = `${candidate}.example`;
    if (!used.has(domain)) return domain;
  }
  for (let n = 2; ; n++) {
    const domain = `${slug}-${n}.example`;
    if (!used.has(domain)) return domain;
  }
}

export function generateCompanies(seed: number = COMPANY_UNIVERSE_SEED): Company[] {
  const rng = createRng(seed);
  const companies: Company[] = [];
  const usedDomains = new Set<string>([
    ...COMPETITORS.map((c) => c.domain),
    ...FREEMAIL_DOMAINS,
    ...VENDOR_COMPANIES.map((v) => v.domain),
    ...UNIVERSITIES.map((u) => u.domain),
  ]);
  const usedNames = new Set<string>();
  for (let attempt = 0; companies.length < ASSUMPTIONS.companyCount; attempt++) {
    if (attempt > 20_000) throw new Error("Could not generate enough unique company names");
    const r = rng.fork(`company:${attempt}`);
    const region = r.weighted(ASSUMPTIONS.companyRegionWeights);
    const country = countryInfo(r.weighted(COUNTRY_WEIGHTS_BY_REGION[region]));
    const industry = r.weighted(ASSUMPTIONS.companyIndustryWeights);
    const sizeBand = r.weighted(ASSUMPTIONS.companySizeWeights);
    const name = companyName(r, country, industry);
    if (usedNames.has(name)) continue;
    const domain = uniqueDomain(r, name, usedDomains);
    usedNames.add(name);
    usedDomains.add(domain);
    const customerRate = ["manufacturing", "retail_ecommerce", "third_party_logistics"].includes(
      industry,
    )
      ? 0.1
      : 0.05;
    companies.push({
      id: `C-${pad(companies.length + 1, 3)}`,
      name,
      legalSuffix: r.pick(country.legalSuffixes),
      domain,
      industry,
      sizeBand,
      region,
      country: country.code,
      isCustomer: r.chance(customerRate),
      isCompetitor: false,
    });
  }
  COMPETITORS.forEach((competitor, index) => {
    companies.push({
      id: `C-9${pad(index + 1, 2)}`,
      name: competitor.name,
      legalSuffix: "Inc.",
      domain: competitor.domain,
      industry: "other",
      sizeBand: "200-999",
      region: "north_america",
      country: "US",
      isCustomer: false,
      isCompetitor: true,
    });
  });
  return companies;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

interface Person {
  truthId: string;
  persona: Persona;
  stage: BuyerStage | null;
  hasNeed: boolean;
  /** The company as the provider knows it, when it does. */
  company: Company | null;
  /** The company name the person would type, if any. */
  typedCompany: string | null;
  legalSuffix: string | null;
  website: string | null;
  emailDomain: string;
  locale: Locale;
  country: CountryInfo | null;
  firstName: string;
  lastName: string;
  title: string | null;
  emailLocal: string;
}

interface Submission {
  person: Person;
  source: LeadSource;
  receivedAt: Date;
  variant: "first" | "same" | "case" | "plus" | "nickname" | "personal";
}

interface PeopleContext {
  prospects: Company[];
  customers: Company[];
  competitors: Company[];
}

const LOCALE_WEIGHTS: Record<Locale, number> = {
  en: 50,
  es: 30,
  pt: 12,
  de: 3,
  fr: 2,
  nl: 1,
  ja: 1,
  hi: 1,
};

function countryForLocale(r: Rng, locale: Locale): CountryInfo {
  const options = COUNTRIES.filter((country) => country.locale === locale);
  return r.pick(options.length > 0 ? options : COUNTRIES);
}

function emailLocalFor(r: Rng, first: string, last: string): string {
  const f = stripAccents(first)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const l = stripAccents(last)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const pattern = r.weighted({
    dotted: 45,
    initialLast: 20,
    firstOnly: 10,
    firstInitial: 10,
    underscore: 5,
    lastInitial: 10,
  });
  switch (pattern) {
    case "dotted":
      return `${f}.${l}`;
    case "initialLast":
      return `${f[0] ?? "x"}${l}`;
    case "firstOnly":
      return f;
    case "firstInitial":
      return `${f}${l[0] ?? ""}`;
    case "underscore":
      return `${f}_${l}`;
    default:
      return `${l}${f[0] ?? ""}`;
  }
}

function freemailLocal(r: Rng, first: string, last: string): string {
  const f = stripAccents(first)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const l = stripAccents(last)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return r.chance(0.5) ? `${f}${l}${r.int(1, 99)}` : `${f}.${l}${r.int(70, 99)}`;
}

function unlistedCompany(
  r: Rng,
  locale: Locale,
): { name: string; domain: string; industry: Industry } {
  const industry = r.weighted(ASSUMPTIONS.companyIndustryWeights);
  const lang = textLang(locale);
  const name =
    lang === "en"
      ? `${r.pick(NAME_STEMS.en)} ${r.pick(INDUSTRY_NOUNS[industry].en)}`
      : `${r.pick(INDUSTRY_NOUNS[industry][lang])} ${r.pick(NAME_STEMS[lang])}`;
  return { name, domain: `${slugify(name)}-co.example`, industry };
}

function buyerTitle(r: Rng, locale: Locale): string {
  return r.pick(BUYER_TITLES[textLang(locale)]);
}

function hasNeedFor(r: Rng, stage: BuyerStage, company: Company | null): boolean {
  const m = ASSUMPTIONS.needFitMultipliers;
  let probability = ASSUMPTIONS.needRateByStage[stage];
  if (company) {
    probability *= m.size[company.sizeBand] * m.industry[company.industry];
    if (company.region === "asia_pacific") probability *= m.asiaPacific;
  } else {
    probability *= m.unknownCompany;
  }
  return r.chance(Math.min(1, probability));
}

function createPerson(r: Rng, truthId: string, ctx: PeopleContext): Person {
  const persona = r.weighted(ASSUMPTIONS.personaWeights);
  let company: Company | null = null;
  let typedCompany: string | null = null;
  let legalSuffix: string | null = null;
  let website: string | null = null;
  let emailDomain: string = r.pick(FREEMAIL_DOMAINS);
  let locale: Locale = r.weighted(LOCALE_WEIGHTS);
  let freemail = true;

  const assignCompany = (chosen: Company) => {
    company = chosen;
    typedCompany = chosen.name;
    legalSuffix = chosen.legalSuffix;
    website = chosen.domain;
    emailDomain = chosen.domain;
    locale = countryInfo(chosen.country).locale;
    freemail = false;
  };

  switch (persona) {
    case "buyer": {
      const situation = r.weighted({
        listed: 84,
        unlisted: 8,
        freemailNamed: 6,
        freemailAnonymous: 2,
      });
      if (situation === "listed") assignCompany(r.pick(ctx.prospects));
      else if (situation === "unlisted") {
        const unlisted = unlistedCompany(r, locale);
        typedCompany = unlisted.name;
        website = unlisted.domain;
        emailDomain = unlisted.domain;
        freemail = false;
      } else if (situation === "freemailNamed") {
        typedCompany = unlistedCompany(r, locale).name;
      }
      break;
    }
    case "existing_customer":
      assignCompany(r.pick(ctx.customers));
      break;
    case "competitor":
      assignCompany(r.pick(ctx.competitors));
      break;
    case "vendor": {
      const vendor = r.pick(VENDOR_COMPANIES);
      typedCompany = vendor.name;
      website = vendor.domain;
      emailDomain = vendor.domain;
      freemail = false;
      break;
    }
    case "student": {
      if (r.chance(0.5)) {
        const university = r.pick(UNIVERSITIES);
        typedCompany = university.name;
        emailDomain = university.domain;
        freemail = false;
      }
      break;
    }
    case "spam":
      if (r.chance(0.4)) {
        emailDomain = `promo-mailer${r.int(1, 9)}.example`;
        freemail = false;
      }
      break;
    default:
      break;
  }

  const country = company ? countryInfo((company as Company).country) : countryForLocale(r, locale);
  const firstName = r.pick(FIRST_NAMES[locale]);
  const lastName = r.pick(LAST_NAMES[locale]);
  const stage = persona === "buyer" ? r.weighted(ASSUMPTIONS.buyerStageWeights) : null;
  const hasNeed = stage ? hasNeedFor(r, stage, company) : false;

  let title: string | null = null;
  if (persona === "buyer") title = buyerTitle(r, locale);
  else if (persona === "existing_customer") title = r.pick(OTHER_TITLES.customer);
  else if (persona === "vendor") title = r.pick(OTHER_TITLES.vendor);
  else if (persona === "competitor") title = r.pick(OTHER_TITLES.competitor);
  else if (persona === "student")
    title = { en: "Student", es: "Estudiante", pt: "Estudante" }[textLang(locale)];
  else if (persona === "job_seeker" && r.chance(0.4)) title = "Logistics Analyst";

  return {
    truthId,
    persona,
    stage,
    hasNeed,
    company,
    typedCompany,
    legalSuffix,
    website,
    emailDomain,
    locale,
    country,
    firstName,
    lastName,
    title,
    emailLocal: freemail
      ? freemailLocal(r, firstName, lastName)
      : emailLocalFor(r, firstName, lastName),
  };
}

/** Pairs of different people who look like duplicates. They test that cleaning does not over-merge. */
function hardNegativePeople(r: Rng, ctx: PeopleContext, startIndex: number): Person[] {
  const people: Person[] = [];
  const bigCompanies = ctx.prospects.filter(
    (c) => c.sizeBand !== "1-49" && c.sizeBand !== "50-199",
  );
  const pairs = r.shuffle(LOOKALIKE_FIRST_NAMES).slice(0, 3);
  let index = startIndex;
  const makeBuyer = (
    company: Company,
    firstName: string,
    lastName: string,
    emailLocal: string,
    title: string,
  ): Person => {
    const stage = r.weighted(ASSUMPTIONS.buyerStageWeights);
    const locale = countryInfo(company.country).locale;
    return {
      truthId: `TP-${pad(++index, 3)}`,
      persona: "buyer",
      stage,
      hasNeed: hasNeedFor(r, stage, company),
      company,
      typedCompany: company.name,
      legalSuffix: company.legalSuffix,
      website: company.domain,
      emailDomain: company.domain,
      locale,
      country: countryInfo(company.country),
      firstName,
      lastName,
      title,
      emailLocal,
    };
  };
  for (const [nameA, nameB] of pairs) {
    const company = r.pick(bigCompanies);
    const locale = countryInfo(company.country).locale;
    const lastName = r.pick(LAST_NAMES[locale]);
    const l = slugify(lastName).replace(/-/g, "");
    people.push(
      makeBuyer(company, nameA, lastName, `${slugify(nameA)}.${l}`, buyerTitle(r, locale)),
    );
    people.push(
      makeBuyer(company, nameB, lastName, `${slugify(nameB)}.${l}`, buyerTitle(r, locale)),
    );
  }
  // Two different people with the same full name at the same company.
  const company = r.pick(bigCompanies);
  const locale = countryInfo(company.country).locale;
  const first = r.pick(FIRST_NAMES[locale]);
  const last = r.pick(LAST_NAMES[locale]);
  const f = slugify(first).replace(/-/g, "");
  const l = slugify(last).replace(/-/g, "");
  const titles = BUYER_TITLES[textLang(locale)];
  people.push(makeBuyer(company, first, last, `${f}.${l}`, titles[0] ?? "Logistics Manager"));
  people.push(
    makeBuyer(
      company,
      first,
      last,
      `${f[0] ?? "x"}${l}`,
      titles[titles.length - 1] ?? "IT Director",
    ),
  );
  return people;
}

// ---------------------------------------------------------------------------
// Rendering messy records
// ---------------------------------------------------------------------------

function receivedTime(r: Rng, weekStart: Date): Date {
  const day = Number(r.weighted({ "0": 18, "1": 18, "2": 18, "3": 18, "4": 18, "5": 5, "6": 5 }));
  const hour = r.chance(0.85) ? r.int(7, 19) : r.int(0, 23);
  const date = new Date(weekStart.getTime());
  date.setUTCDate(date.getUTCDate() + day);
  date.setUTCHours(hour, r.int(0, 59), r.int(0, 59), 0);
  return date;
}

function renderName(r: Rng, value: string): string {
  const d = ASSUMPTIONS.defects;
  const roll = r.next();
  if (roll < d.nameLowercase) return value.toLowerCase();
  if (roll < d.nameLowercase + d.nameUppercase) return value.toUpperCase();
  if (roll < d.nameLowercase + d.nameUppercase + d.nameExtraWhitespace)
    return ` ${value.replace(" ", "  ")} `;
  return value;
}

function renderEmail(
  r: Rng,
  local: string,
  domain: string,
  variant: Submission["variant"],
): string {
  const d = ASSUMPTIONS.defects;
  if (r.chance(d.emailInvalid)) {
    return r.pick(["n/a", `${local}@`, `${local} at ${domain.replace(".", " dot ")}`, "test"]);
  }
  let address = `${local}@${domain}`;
  if (variant === "plus" || r.chance(d.emailPlusTag)) {
    address = `${local}+${r.pick(["webinar", "larkspur", "news", "demo"])}@${domain}`;
  }
  if (variant === "case" || r.chance(d.emailMixedCase)) {
    address = address
      .split("@")
      .map((part, index) =>
        index === 0
          ? part.replace(
              /(^|[._])([a-z])/g,
              (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
            )
          : part,
      )
      .join("@");
  }
  return address;
}

function renderCompany(r: Rng, person: Person): string | null {
  if (!person.typedCompany) return null;
  const name = person.typedCompany;
  const style = r.weighted({
    withSuffix: 35,
    plain: 35,
    lower: 8,
    initials: 5,
    typo: 4,
    missing: 13,
  });
  switch (style) {
    case "withSuffix":
      return person.legalSuffix ? `${name} ${person.legalSuffix}` : name;
    case "plain":
      return name;
    case "lower":
      return name.toLowerCase();
    case "initials":
      return name
        .split(" ")
        .map((word) => word[0] ?? "")
        .join("")
        .toUpperCase();
    case "typo": {
      if (name.length < 5) return name;
      const i = r.int(1, name.length - 3);
      return name.slice(0, i) + (name[i + 1] ?? "") + (name[i] ?? "") + name.slice(i + 2);
    }
    default:
      return null;
  }
}

function renderWebsite(r: Rng, person: Person): string | null {
  if (!person.website || !r.chance(0.45)) return null;
  const domain = person.website;
  return r.pick([
    `https://www.${domain}`,
    `www.${domain}`,
    domain,
    `http://${domain}/`,
    `https://${domain}/contact`,
  ]);
}

function renderCountry(r: Rng, person: Person): string | null {
  if (!person.country || r.chance(ASSUMPTIONS.defects.countryMissing)) return null;
  const variants = person.country.variants;
  return r.chance(0.5) ? (variants[0] ?? null) : r.pick(variants);
}

function renderTitle(r: Rng, person: Person): string | null {
  if (!person.title || r.chance(ASSUMPTIONS.defects.titleMissing)) return null;
  return r.chance(0.05) ? person.title.toLowerCase() : person.title;
}

function activityFor(r: Rng, person: Person): RawLead["activity"] {
  const profile =
    person.stage === "active_evaluation"
      ? { views: 2.2, docs: 1.6, webinar: 0.25, clicks: 1.5, recency: [0, 4] as const, none: 0 }
      : person.stage === "problem_aware"
        ? {
            views: 0.9,
            docs: 1.0,
            webinar: 0.35,
            clicks: 1.0,
            recency: [0, 10] as const,
            none: 0.05,
          }
        : person.stage === "researching"
          ? {
              views: 0.3,
              docs: 0.6,
              webinar: 0.4,
              clicks: 0.6,
              recency: [2, 25] as const,
              none: 0.2,
            }
          : {
              views: 0.2,
              docs: 0.3,
              webinar: 0.05,
              clicks: 0.2,
              recency: [0, 20] as const,
              none: 0.5,
            };
  if (r.chance(profile.none)) {
    return {
      pricingPageViews: 0,
      docsVisits: 0,
      webinarAttended: false,
      emailClicks: 0,
      lastActivityDaysAgo: null,
    };
  }
  const activity = {
    pricingPageViews: r.poisson(profile.views),
    docsVisits: r.poisson(profile.docs),
    webinarAttended: r.chance(profile.webinar),
    emailClicks: r.poisson(profile.clicks),
    lastActivityDaysAgo: r.int(profile.recency[0], profile.recency[1]) as number | null,
  };
  if (
    activity.pricingPageViews + activity.docsVisits + activity.emailClicks === 0 &&
    !activity.webinarAttended
  ) {
    activity.lastActivityDaysAgo = null;
  }
  return activity;
}

function messageLanguage(r: Rng, locale: Locale): "en" | "es" | "pt" {
  if (locale === "es") return r.chance(0.7) ? "es" : "en";
  if (locale === "pt") return r.chance(0.75) ? "pt" : "en";
  return "en";
}

function templateFits(template: MessageTemplate, person: Person, channel: Channel): boolean {
  if (template.channel !== channel || template.persona !== person.persona) return false;
  if (template.id.startsWith("IJ")) return false;
  if (template.text.includes("{company}") && !person.typedCompany) return false;
  if (person.persona !== "buyer") return true;
  const stageOk =
    template.stages.length === 0 ||
    (person.stage !== null && template.stages.includes(person.stage));
  const needOk = template.need === null || template.need === person.hasNeed;
  return stageOk && needOk;
}

/** Templates that fit everyone ("pricing?", "call me") are drawn less often than specific ones. */
function templateWeight(template: MessageTemplate): number {
  return template.stages.length === 0 && template.persona === "buyer" ? 0.25 : 1;
}

function chooseTemplate(r: Rng, person: Person, channel: Channel): MessageTemplate | null {
  const lang =
    channel === "form"
      ? messageLanguage(r, person.locale)
      : person.locale === "es" && r.chance(0.5)
        ? "es"
        : "en";
  if ((person.persona === "buyer" || person.persona === "spam") && channel === "form") {
    const injectionChance = person.persona === "spam" ? 0.15 : ASSUMPTIONS.injectionRate;
    if (r.chance(injectionChance)) {
      const injections = MESSAGE_TEMPLATES.filter(
        (t) => t.id.startsWith("IJ") && (t.lang === lang || t.lang === "en"),
      );
      if (injections.length > 0) return r.pick(injections);
    }
  }
  const fitting = MESSAGE_TEMPLATES.filter((template) => templateFits(template, person, channel));
  const inLanguage = fitting.filter((template) => template.lang === lang);
  const pool =
    inLanguage.length > 0 ? inLanguage : fitting.filter((template) => template.lang === "en");
  if (pool.length === 0) return null;
  const weights: Record<string, number> = {};
  for (const template of pool) weights[template.id] = templateWeight(template);
  const id = r.weighted(weights);
  return pool.find((template) => template.id === id) ?? null;
}

function fillTemplate(r: Rng, template: MessageTemplate, person: Person): string {
  const lang = template.lang;
  const replacements: Record<string, () => string> = {
    company: () => person.typedCompany ?? "our company",
    volume: () => r.pick(VOLUMES[lang]),
    carriers: () => String(r.int(6, 60)),
    sites: () => String(r.int(2, 14)),
    tool: () => r.pick(CURRENT_TOOLS),
    competitor: () => r.pick(COMPETITORS).name,
  };
  return template.text.replace(
    /\{(\w+)\}/g,
    (match, key: string) => replacements[key]?.() ?? match,
  );
}

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------

function sourceFor(r: Rng, person: Person, exclude?: LeadSource): LeadSource {
  const weights: Record<LeadSource, number> = {
    ...(person.persona === "buyer" && person.stage
      ? ASSUMPTIONS.sourceWeightsByStage[person.stage]
      : PERSONA_SOURCE_WEIGHTS[person.persona as Exclude<Persona, "buyer">]),
  };
  if (exclude && Object.values(weights).filter((w) => w > 0).length > 1) weights[exclude] = 0;
  return r.weighted(weights);
}

export function generateWeek(week: WeekSpec, companies: Company[]): Dataset {
  const rng = createRng(week.seed);
  const weekStart = new Date(`${week.start}T00:00:00Z`);
  const weekEnd = new Date(`${week.end}T23:59:59Z`);
  const ctx: PeopleContext = {
    prospects: companies.filter((c) => !c.isCustomer && !c.isCompetitor),
    customers: companies.filter((c) => c.isCustomer),
    competitors: companies.filter((c) => c.isCompetitor),
  };

  const people: Person[] = hardNegativePeople(rng.fork("hard-negatives"), ctx, 0);
  const submissions: Submission[] = [];
  for (const person of people) {
    const r = rng.fork(`submission:${person.truthId}`);
    submissions.push({
      person,
      source: sourceFor(r, person),
      receivedAt: receivedTime(r, weekStart),
      variant: "first",
    });
  }

  for (let index = people.length + 1; submissions.length < RAW_LEADS_PER_WEEK; index++) {
    const r = rng.fork(`person:${index}`);
    const person = createPerson(r, `TP-${pad(index, 3)}`, ctx);
    people.push(person);
    const first: Submission = {
      person,
      source: sourceFor(r, person),
      receivedAt: receivedTime(r, weekStart),
      variant: "first",
    };
    submissions.push(first);
    const duplicateRate =
      person.persona === "spam"
        ? 0
        : person.persona === "vendor"
          ? 0.05
          : ASSUMPTIONS.duplicateSubmissionRate;
    if (submissions.length < RAW_LEADS_PER_WEEK && r.chance(duplicateRate)) {
      const hoursLater = r.int(1, 72);
      let receivedAt = new Date(first.receivedAt.getTime() + hoursLater * 3_600_000);
      if (receivedAt > weekEnd) receivedAt = new Date(first.receivedAt.getTime() + 30 * 60_000);
      const canNickname = NICKNAME_FOR[person.firstName] !== undefined;
      const variant = r.weighted({
        same: 45,
        case: 20,
        plus: 10,
        nickname: canNickname ? 15 : 0,
        personal: 10,
      });
      submissions.push({ person, source: sourceFor(r, person, first.source), receivedAt, variant });
    }
  }

  submissions.sort(
    (a, b) =>
      a.receivedAt.getTime() - b.receivedAt.getTime() ||
      a.person.truthId.localeCompare(b.person.truthId),
  );

  const rawLeads: RawLead[] = [];
  const messages: MessageTruth[] = [];
  const rawIdsByPerson = new Map<string, string[]>();

  submissions.forEach((submission, i) => {
    const rawId = `R-${pad(i + 1, 4)}`;
    const person = submission.person;
    const r = rng.fork(`render:${rawId}`);
    const nickname = submission.variant === "nickname" ? NICKNAME_FOR[person.firstName] : undefined;
    const firstName = nickname ?? person.firstName;

    let emailLocal = person.emailLocal;
    let emailDomain = person.emailDomain;
    if (nickname) emailLocal = emailLocalFor(r, nickname, person.lastName);
    if (submission.variant === "personal") {
      emailLocal = freemailLocal(r, person.firstName, person.lastName);
      emailDomain = r.pick<string>(FREEMAIL_DOMAINS);
    }

    const lastMissing = r.chance(ASSUMPTIONS.defects.lastNameMissing);
    let message: string | null = null;
    if (r.chance(ASSUMPTIONS.messageRateBySource[submission.source])) {
      const template = chooseTemplate(r, person, CHANNEL_BY_SOURCE[submission.source]);
      if (template) {
        message = fillTemplate(r, template, person);
        messages.push({
          rawId,
          templateId: template.id,
          signals: template.signals,
          accept: template.accept,
        });
      }
    }

    rawLeads.push({
      rawId,
      receivedAt: submission.receivedAt.toISOString(),
      source: submission.source,
      firstName: renderName(r, firstName),
      lastName: lastMissing ? null : renderName(r, person.lastName),
      email: renderEmail(r, emailLocal, emailDomain, submission.variant),
      companyName: renderCompany(r, person),
      website: renderWebsite(r, person),
      country: renderCountry(r, person),
      jobTitle: renderTitle(r, person),
      message,
      activity: activityFor(r, person),
    });
    const ids = rawIdsByPerson.get(person.truthId) ?? [];
    ids.push(rawId);
    rawIdsByPerson.set(person.truthId, ids);
  });

  const truthPeople: PersonTruth[] = people
    .filter((person) => rawIdsByPerson.has(person.truthId))
    .map((person) => ({
      personId: person.truthId,
      rawIds: rawIdsByPerson.get(person.truthId) ?? [],
      companyId: person.company?.id ?? null,
      persona: person.persona,
      stage: person.stage,
      hasNeed: person.hasNeed,
    }));

  const suppressionRng = rng.fork("suppressions");
  const suppressions = [
    ...people
      .filter(
        (person) => person.persona !== "spam" && suppressionRng.chance(ASSUMPTIONS.suppressionRate),
      )
      .map((person) => `${person.emailLocal}@${person.emailDomain}`.toLowerCase()),
    ...Array.from(
      { length: 25 },
      (_, i) => `former.contact${i + 1}@${suppressionRng.pick(FREEMAIL_DOMAINS)}`,
    ),
  ].sort();

  return {
    id: week.id,
    label: week.label,
    seed: week.seed,
    generatorVersion: GENERATOR_VERSION,
    weekStart: week.start,
    weekEnd: week.end,
    companies,
    rawLeads,
    suppressions,
    truth: { people: truthPeople, messages },
  };
}
