/**
 * Reference data the cleaning and routing rules rely on: the configuration a revenue
 * operations team would maintain. Kept apart from the synthetic data generator, so the
 * rules never learn anything from how the data was made.
 */
import type { Region } from "./model";

/** Free email providers. Fictional, but they behave like real ones for matching. */
export const FREEMAIL_DOMAINS = [
  "freemail.example",
  "postbox.example",
  "webinbox.example",
] as const;

/** Fictional competitors of Larkspur. People from these domains are not sales leads. */
export const COMPETITORS = [
  { name: "Routewise", domain: "routewise.example" },
  { name: "Freightbase", domain: "freightbase.example" },
  { name: "Lanewatch", domain: "lanewatch.example" },
] as const;

/** Nickname to formal first name, lowercase and without accents. */
export const NICKNAMES: Record<string, string> = {
  bob: "robert",
  rob: "robert",
  bill: "william",
  will: "william",
  mike: "michael",
  jim: "james",
  jimmy: "james",
  liz: "elizabeth",
  beth: "elizabeth",
  sue: "susan",
  joe: "joseph",
  jess: "jessica",
  tom: "thomas",
  chris: "christopher",
  dan: "daniel",
  danny: "daniel",
  matt: "matthew",
  tony: "anthony",
  steve: "steven",
  andy: "andrew",
  drew: "andrew",
  nate: "nathan",
  pepe: "jose",
  paco: "francisco",
  nacho: "ignacio",
  lucho: "luis",
  caro: "carolina",
  sebas: "sebastian",
  vale: "valentina",
  fer: "fernando",
  gabi: "gabriela",
  rafa: "rafael",
  guto: "gustavo",
  max: "maximilian",
};

export interface CountryReference {
  code: string;
  name: string;
  region: Region;
  /** Lowercase, accent-free spellings, with dots removed. */
  aliases: string[];
}

export const COUNTRY_REFERENCE: CountryReference[] = [
  {
    code: "US",
    name: "United States",
    region: "north_america",
    aliases: ["united states", "united states of america", "usa", "us", "america"],
  },
  { code: "CA", name: "Canada", region: "north_america", aliases: ["canada", "ca", "can"] },
  { code: "MX", name: "Mexico", region: "latin_america", aliases: ["mexico", "mx", "mex"] },
  { code: "CO", name: "Colombia", region: "latin_america", aliases: ["colombia", "co", "col"] },
  {
    code: "BR",
    name: "Brazil",
    region: "latin_america",
    aliases: ["brazil", "brasil", "br", "bra"],
  },
  { code: "CL", name: "Chile", region: "latin_america", aliases: ["chile", "cl", "chl"] },
  { code: "PE", name: "Peru", region: "latin_america", aliases: ["peru", "pe", "per"] },
  { code: "AR", name: "Argentina", region: "latin_america", aliases: ["argentina", "ar", "arg"] },
  {
    code: "DE",
    name: "Germany",
    region: "europe",
    aliases: ["germany", "deutschland", "de", "deu", "ger"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    region: "europe",
    aliases: [
      "united kingdom",
      "uk",
      "great britain",
      "britain",
      "england",
      "scotland",
      "wales",
      "gb",
      "gbr",
    ],
  },
  { code: "ES", name: "Spain", region: "europe", aliases: ["spain", "espana", "es", "esp"] },
  {
    code: "NL",
    name: "Netherlands",
    region: "europe",
    aliases: ["netherlands", "the netherlands", "holland", "nederland", "nl", "nld"],
  },
  { code: "FR", name: "France", region: "europe", aliases: ["france", "fr", "fra"] },
  { code: "SG", name: "Singapore", region: "asia_pacific", aliases: ["singapore", "sg", "sgp"] },
  { code: "AU", name: "Australia", region: "asia_pacific", aliases: ["australia", "au", "aus"] },
  { code: "JP", name: "Japan", region: "asia_pacific", aliases: ["japan", "jp", "jpn"] },
  { code: "IN", name: "India", region: "asia_pacific", aliases: ["india", "in", "ind"] },
];

/** Legal suffixes removed when comparing company names. Lowercase, dots removed. */
export const LEGAL_SUFFIXES = [
  "inc",
  "llc",
  "corp",
  "ltd",
  "ltda",
  "sa de cv",
  "sas",
  "sa",
  "spa",
  "sac",
  "srl",
  "gmbh",
  "ag",
  "bv",
  "nv",
  "plc",
  "sarl",
  "pte ltd",
  "pty ltd",
  "kk",
  "pvt ltd",
  "co",
];

/** Words kept in capitals when a lowercase job title is tidied. */
export const TITLE_ACRONYMS = [
  "vp",
  "svp",
  "evp",
  "it",
  "ceo",
  "coo",
  "cfo",
  "cto",
  "cio",
  "tms",
  "erp",
  "edi",
  "3pl",
  "ops",
];
