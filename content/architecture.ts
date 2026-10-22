/**
 * Hand-written parts of the "Under the hood" page: requirements, the pipeline, design decisions
 * and limitations. Everything else on that page is rendered from the code itself.
 */
import { ASSUMPTIONS, RAW_LEADS_PER_WEEK } from "@/core/dataset/generate";
import { MESSAGE_TEMPLATES } from "@/core/dataset/messages";

/** Readable names for the planted defects in the generator's assumptions. */
export const DEFECT_LABELS: Record<keyof typeof ASSUMPTIONS.defects, string> = {
  nameLowercase: "Name typed in lowercase",
  nameUppercase: "Name typed in capitals",
  nameExtraWhitespace: "Extra spaces in the name",
  lastNameMissing: "Last name missing",
  emailMixedCase: "Email in mixed case",
  emailPlusTag: "Email with a +tag",
  emailInvalid: "Email invalid",
  companyMissing: "Company left blank",
  countryMissing: "Country left blank",
  titleMissing: "Job title left blank",
};

export interface Requirement {
  id: string;
  text: string;
  /** Where the requirement is enforced. */
  enforcedBy: string;
}

export const REQUIREMENTS: Requirement[] = [
  {
    id: "R1",
    text: "Turn messy submissions into one record per person, and explain every change and every merge.",
    enforcedBy: "Cleaning and duplicate tests; each case file lists the changes and merges.",
  },
  {
    id: "R2",
    text: "Never send a lead to sales without a valid email, and keep opt-outs, competitors and existing customers out of the sales queue.",
    enforcedBy: "Eligibility rules run first, in a fixed order; routing tests cover each one.",
  },
  {
    id: "R3",
    text: "Rank everyone else with a score where every point has a stated reason.",
    enforcedBy:
      "Published scoring tables; property tests check that more buying signals never lower a score.",
  },
  {
    id: "R4",
    text: "Respect capacity: call no more people than sales can call, in an order that can be defended.",
    enforcedBy:
      "Queue tests: exactly min(capacity, queue) calls, and more capacity never removes a call.",
  },
  {
    id: "R5",
    text: "Use AI as evidence, never as the decision. Answers must match a schema, quote the message and meet a confidence policy. Doubtful answers that would change a lane go to a person.",
    enforcedBy: "Structured outputs, quote verification, and routing tests for every AI policy.",
  },
  {
    id: "R6",
    text: "Measure outcomes with SQL anyone can read, and keep it identical to the code.",
    enforcedBy: "A parity test runs the SQL and the TypeScript metrics over random settings.",
  },
  {
    id: "R7",
    text: "Be reproducible: the same data and settings always give the same result, and any view can be shared as a link.",
    enforcedBy:
      "Seeded generator, a test that the published files match it, and settings stored in the address.",
  },
];

export interface PipelineStep {
  name: string;
  when: "offline" | "once per week" | "on every change";
  text: string;
  code: string[];
}

export const PIPELINE: PipelineStep[] = [
  {
    name: "Generate",
    when: "offline",
    text: `A seeded generator creates ${ASSUMPTIONS.companyCount} companies and three weeks of ${RAW_LEADS_PER_WEEK} form submissions each, with planted defects. What it knows about each person, the answer key, goes to a separate file.`,
    code: ["core/dataset/generate.ts", "scripts/generate-datasets.ts"],
  },
  {
    name: "Extract",
    when: "offline",
    text: "A small model reads each free-text message once and returns structured signals. The answers are stored with the model name, date, prompt version and cost. The site never calls a model.",
    code: ["scripts/extract-dataset.ts", "server/ai/extract.ts", "core/ai/prompt.ts"],
  },
  {
    name: "Clean",
    when: "once per week",
    text: "Names, emails, companies, websites, countries and titles are normalized. Every change is recorded with its reason.",
    code: ["core/cleaning/normalize.ts"],
  },
  {
    name: "Merge duplicates",
    when: "once per week",
    text: "Two cautious rules merge submissions from the same person; near matches are flagged and kept apart. Merged leads pick each field by a stated rule.",
    code: ["core/cleaning/dedupe.ts", "core/cleaning/pipeline.ts"],
  },
  {
    name: "Match companies",
    when: "once per week",
    text: "Each lead is matched to the simulated company data by email domain, then website, then exact company name. No match is better than a wrong match.",
    code: ["core/cleaning/enrich.ts"],
  },
  {
    name: "Check AI answers",
    when: "once per week",
    text: "Every quote must appear in the message, and fields that add points must have one. Otherwise the answer's confidence drops to low.",
    code: ["core/ai/verify.ts", "core/ai/outputs.ts"],
  },
  {
    name: "Score and route",
    when: "on every change",
    text: "Eligibility rules, then AI rules if the policy allows, then the score threshold. Qualified leads queue for the week's calls.",
    code: ["core/scoring/score.ts", "core/routing/route.ts"],
  },
  {
    name: "Measure",
    when: "on every change",
    text: "Decisions are written to SQLite in the browser, next to the answer key, and every metric is a query over them.",
    code: ["core/sql/schema.ts", "core/sql/queries.ts", "lib/lab/sql.ts"],
  },
];

export interface DecisionRecord {
  title: string;
  context: string;
  decision: string;
  consequence: string;
}

export const DECISIONS: DecisionRecord[] = [
  {
    title: "A backtest, not a forecast",
    context:
      "A simulator that predicts revenue would show numbers nobody can check, and invented business impact is exactly what a careful reviewer distrusts.",
    decision:
      "Replay the rules over a fixed synthetic week and count outcomes against an answer key: needs reached, calls wasted, cases for review. No revenue and no conversion rates.",
    consequence:
      "Every number can be traced to a query. The answer key comes from the same generator as the data, so the lab demonstrates how the system behaves, not how a market would respond.",
  },
  {
    title: "The answer key is kept away from the rules",
    context: "If the rules could see the answer key, the lab would be grading its own homework.",
    decision:
      "Publish the answer key in its own file. The cleaning, scoring, routing and AI code cannot import the dataset or backtest modules.",
    consequence: "An architecture test fails the build if anyone adds such an import.",
  },
  {
    title: "Rules decide; AI adds evidence",
    context:
      "Messages carry signals that fields do not, such as a timeline or a budget, but a model can be wrong, can be manipulated and can be confidently vague.",
    decision:
      "The model fills a fixed schema with quotes from the message. Data rules always run first. Only trusted signals change a score, and a doubtful signal that would change a lane sends the lead to a person.",
    consequence:
      "AI can lift a quiet buyer into the sales queue or take a support request out of it, but it cannot override a missing email or an opt-out.",
  },
  {
    title: "Stored AI outputs first, live AI later",
    context:
      "Calling a model from a public page costs money per visitor and invites abuse, and the first release should be safe to publish.",
    decision:
      "Run extraction offline from a GitHub workflow that keeps the key server-side, stops at a cost cap and stores the results with the model and date. Live extraction, rate-limited and budget-capped, comes in the next release.",
    consequence: "Every AI output on the site is labeled as stored, with the run it came from.",
  },
  {
    title: "A small, fast model for extraction",
    context:
      "Short messages and a fixed schema make this a classification and extraction task, not a reasoning task.",
    decision:
      "Use Claude Haiku 5.5 at low effort with structured outputs. Keep the model a setting, so a larger one can be compared on the same scorecard.",
    consequence:
      "A dry run estimates about 13 cents per week of messages, and the stored run cost about 8. The scorecard shows where the small model falls short.",
  },
  {
    title: "SQLite in the browser",
    context:
      "Metrics computed by real SQL should run where the visitor can see them, without a database server to secure.",
    decision:
      "Load the week into SQLite compiled to WebAssembly (sql.js, about 650 KB) after the page renders. DuckDB-WASM was considered and rejected for its size.",
    consequence:
      "Every metric is a query on the visitor's device, and the SQL console can explore the same tables. A server database arrives with the sandbox action in the next release.",
  },
  {
    title: "Two implementations of the metrics, kept equal",
    context:
      "The interface needs numbers before SQLite has loaded, and SQL alone is hard to unit-test.",
    decision:
      "Compute the metrics in TypeScript as the reference, publish them as SQL, and test that both agree over random settings.",
    consequence: "If the two ever disagree on screen, the page says so.",
  },
  {
    title: "Cautious duplicate rules",
    context:
      "A false merge hides a person from sales and mixes two people's data. A missed duplicate costs one extra record.",
    decision:
      "Merge only on the same email, or on the same name and company domain when titles do not conflict. Flag look-alike names for a person.",
    consequence:
      "The data quality report shows the cost openly: a few missed duplicates each week, and the rare false merge when two colleagues share a name.",
  },
  {
    title: "A static site, no server runtime",
    context: "The first release has nothing that needs a server, and less to run is less to break.",
    decision:
      "Pre-render every page, compute in the browser, and use a strict content security policy that only allows requests to this site.",
    consequence: "Nothing a visitor does leaves their browser.",
  },
];

export const LIMITATIONS: string[] = [
  "The answer key comes from the same generator that wrote the data. The lab shows how the rules behave under these assumptions, not how they would perform on a real market.",
  `Each week has ${RAW_LEADS_PER_WEEK} submissions, so differences of one or two needs are noise. The lab reports counts rather than precise rates for that reason.`,
  "AI outputs are produced offline, once per prompt version, and stored, so a visitor cannot try a message of their own yet.",
  `The messages come from ${MESSAGE_TEMPLATES.length} hand-written templates, so the AI scorecard measures extraction on short messages written for this demo, not on real inbound mail.`,
  "The human review lane shows who would need a person, but there is no review queue yet. Approving, correcting and escalating cases, and the sandbox action with its audit log, are planned for the next release.",
  "Scoring weights are set by hand, not fitted to data. The calibration chart shows how well they rank leads.",
  "Company matching uses exact domains and names. There is no fuzzy matching of company names.",
];
