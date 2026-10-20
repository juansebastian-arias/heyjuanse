import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { z } from "zod";
import {
  DECISIONS,
  DEFECT_LABELS,
  LIMITATIONS,
  PIPELINE,
  REQUIREMENTS,
} from "@/content/architecture";
import { DEFAULT_EFFORT, DEFAULT_MAX_COST_USD, DEFAULT_MODEL, PRICING } from "@/core/ai/config";
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from "@/core/ai/prompt";
import { ExtractionSchema } from "@/core/ai/schema";
import { AI_POLICY_LABELS } from "@/core/ai/signals";
import { DUPLICATE_RULES } from "@/core/cleaning/dedupe";
import { MATCH_METHOD_LABELS } from "@/core/cleaning/enrich";
import { SURVIVORSHIP_RULES } from "@/core/cleaning/pipeline";
import { ASSUMPTIONS, GENERATOR_VERSION, RAW_LEADS_PER_WEEK } from "@/core/dataset/generate";
import {
  INDUSTRY_LABELS,
  INTENT_LABELS,
  type LeadSource,
  REGION_LABELS,
  SIZE_LABELS,
  SOURCE_LABELS,
} from "@/core/model";
import {
  AI_INTENT_RULES,
  DATA_RULES,
  DEFAULT_ROUTING,
  LANE_LABELS,
  QUEUE_ORDER_LABELS,
  REASONS,
} from "@/core/routing/route";
import { AI_POINTS, FIT_POINTS, GROUP_LIMITS, INTENT_POINTS } from "@/core/scoring/rules";
import { METRIC_QUERIES } from "@/core/sql/queries";
import { SCHEMA_SQL } from "@/core/sql/schema";
import { readTestReport, TEST_REPORT_PATH } from "@/lib/server/tests";
import { readWeek } from "@/lib/server/week-files";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Under the hood",
  description:
    "Requirements, data flow, rule catalogue, SQL, the AI contract, tests, design decisions and known limitations of the Decision Lab, rendered from the code that runs it.",
};

const SECTIONS = [
  { id: "problem", title: "The problem" },
  { id: "pipeline", title: "How a lead moves" },
  { id: "data", title: "Synthetic data" },
  { id: "cleaning", title: "Cleaning and duplicates" },
  { id: "rules", title: "Rules and scoring" },
  { id: "sql", title: "Data model and SQL" },
  { id: "ai", title: "The AI contract" },
  { id: "testing", title: "Tests" },
  { id: "decisions", title: "Decisions" },
  { id: "limitations", title: "Limitations" },
];

/** "existing_customer" → "Existing customer". */
const human = (key: string) => {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Signed points with a true minus sign: +6, −2, 0. */
const signed = (value: number) =>
  value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";

const usd = (value: number) => `$${value.toFixed(2)}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

function Section({
  id,
  title,
  children,
  lede,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>
        {title}
      </h2>
      {lede ? <div className={styles.sectionLede}>{lede}</div> : null}
      {children}
    </section>
  );
}

function PointsTable({
  caption,
  rows,
}: {
  caption: string;
  rows: Array<[string, number | string]>;
}) {
  return (
    <table className={styles.table}>
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([label, points]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td className={styles.number}>
              {typeof points === "number" ? signed(points) : points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WeightsTable({ caption, weights }: { caption: string; weights: Record<string, number> }) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return (
    <table className={styles.table}>
      <caption>{caption}</caption>
      <tbody>
        {Object.entries(weights).map(([key, value]) => (
          <tr key={key}>
            <th scope="row">{human(key)}</th>
            <td className={styles.number}>{Math.round((100 * value) / total)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function sampleMessage(): string {
  const { leads } = readWeek("2026-w41");
  const raw = leads.rawLeads.find(
    (lead) => lead.source === "demo_request" && lead.message && lead.message.length > 160,
  );
  if (!raw?.message) return "";
  return buildUserMessage({ receivedAt: raw.receivedAt, source: raw.source, message: raw.message });
}

export default function ArchitecturePage() {
  const report = readTestReport();
  const jsonSchema = JSON.stringify(z.toJSONSchema(ExtractionSchema), null, 2);
  const price = PRICING[DEFAULT_MODEL];

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">Under the hood</p>
        <h1 className={styles.title}>How the Decision Lab is built</h1>
        <p className={styles.lede}>
          For a technical reviewer with ten minutes. The rule tables, queries, prompt, schema and
          test names below are rendered from the code that runs the <Link href="/lab">lab</Link>, so
          they cannot drift from it. The full source is on <a href={SITE.repository}>GitHub</a>.
        </p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="On this page">
          <p className={styles.tocTitle}>On this page</p>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.content}>
          <Section
            id="problem"
            title="The problem"
            lede={
              <p>
                Larkspur, a fictional freight-operations software company, gets {RAW_LEADS_PER_WEEK}{" "}
                inbound form submissions a week, and its sales team can make{" "}
                {DEFAULT_ROUTING.capacity} calls by default. The submissions are messy: typos,
                duplicates, personal emails, missing companies, support requests sent through the
                sales form, and the occasional message written to manipulate an AI. The system has
                to decide who gets a call, and say why.
              </p>
            }
          >
            <table className={styles.table}>
              <caption>Requirements</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Requirement, and what enforces it</th>
                </tr>
              </thead>
              <tbody>
                {REQUIREMENTS.map((requirement) => (
                  <tr key={requirement.id}>
                    <th scope="row" className={styles.mono}>
                      {requirement.id}
                    </th>
                    <td>
                      <p>{requirement.text}</p>
                      <p className={styles.secondary}>
                        <span className={styles.label}>Enforced by</span> {requirement.enforcedBy}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            id="pipeline"
            title="How a lead moves through the system"
            lede={
              <p>
                Two steps run offline in the repository. Everything else runs in the visitor’s
                browser: the business logic is plain TypeScript in <code>core/</code>, with no
                dependency on React or Next.js, so it is tested on its own.
              </p>
            }
          >
            <ol className={styles.pipeline}>
              {PIPELINE.map((step, index) => (
                <li key={step.name} className={styles.step} data-when={step.when}>
                  <span className={styles.stepIndex} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <p className={styles.stepHead}>
                      <strong>{step.name}</strong>
                      <span className={styles.when}>{step.when}</span>
                    </p>
                    <p className={styles.stepText}>{step.text}</p>
                    <p className={styles.code}>
                      {step.code.map((path) => (
                        <code key={path}>{path}</code>
                      ))}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            id="data"
            title="Synthetic data and its assumptions"
            lede={
              <p>
                Every person, company and message is generated. The generator (version{" "}
                {GENERATOR_VERSION}) is seeded, so each week is identical on every machine, and a
                test fails if the published files differ from what it produces. These are its
                assumptions, as written in the code. They are choices, not market data.
              </p>
            }
          >
            <div className={styles.grid3}>
              <WeightsTable caption="Who fills in the forms" weights={ASSUMPTIONS.personaWeights} />
              <WeightsTable
                caption="How far along buyers are"
                weights={ASSUMPTIONS.buyerStageWeights}
              />
              <table className={styles.table}>
                <caption>Chance a buyer has a real need</caption>
                <tbody>
                  {Object.entries(ASSUMPTIONS.needRateByStage).map(([stage, rate]) => (
                    <tr key={stage}>
                      <th scope="row">{human(stage)}</th>
                      <td className={styles.number}>{Math.round(rate * 100)}%</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">× small companies (1–49)</th>
                    <td className={styles.number}>{ASSUMPTIONS.needFitMultipliers.size["1-49"]}</td>
                  </tr>
                  <tr>
                    <th scope="row">× unknown company</th>
                    <td className={styles.number}>
                      {ASSUMPTIONS.needFitMultipliers.unknownCompany}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">× Asia-Pacific</th>
                    <td className={styles.number}>{ASSUMPTIONS.needFitMultipliers.asiaPacific}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <table className={`${styles.table} ${styles.narrow}`}>
              <caption>Planted defects, per submission</caption>
              <tbody>
                <tr>
                  <th scope="row">Person submits more than once</th>
                  <td className={styles.number}>
                    {(ASSUMPTIONS.duplicateSubmissionRate * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <th scope="row">Message tries to instruct an AI</th>
                  <td className={styles.number}>{(ASSUMPTIONS.injectionRate * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <th scope="row">Email on the opt-out list</th>
                  <td className={styles.number}>
                    {(ASSUMPTIONS.suppressionRate * 100).toFixed(1)}%
                  </td>
                </tr>
                {Object.entries(ASSUMPTIONS.defects).map(([defect, rate]) => (
                  <tr key={defect}>
                    <th scope="row">{DEFECT_LABELS[defect as keyof typeof DEFECT_LABELS]}</th>
                    <td className={styles.number}>{(rate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>
              Hard cases are planted on purpose: look-alike names at the same company, colleagues
              who share a name, nicknames, personal emails, companies typed four different ways,
              Spanish and Portuguese messages, and messages that try to instruct the AI. The full
              assumptions, including source and message rates, are in{" "}
              <code>core/dataset/generate.ts</code>.
            </p>
          </Section>

          <Section
            id="cleaning"
            title="Cleaning and duplicates"
            lede={
              <p>
                A false merge hides a person from sales and mixes two people’s data, while a missed
                duplicate costs one extra record. So the rules merge only when they are sure, and
                flag the rest for a person.
              </p>
            }
          >
            <table className={styles.table}>
              <caption>Duplicate rules</caption>
              <thead>
                <tr>
                  <th scope="col">Rule</th>
                  <th scope="col">When, and what happens</th>
                </tr>
              </thead>
              <tbody>
                {DUPLICATE_RULES.map((rule) => (
                  <tr key={rule.code}>
                    <th scope="row" className={styles.mono}>
                      {rule.code}
                    </th>
                    <td>
                      <p>
                        <span className={styles.label}>When</span> {rule.when}
                      </p>
                      <p className={styles.secondary}>
                        <span className={styles.label}>Then</span> {rule.action}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.grid2}>
              <table className={styles.table}>
                <caption>Which value a merged lead keeps</caption>
                <tbody>
                  {Object.entries(SURVIVORSHIP_RULES).map(([field, rule]) => (
                    <tr key={field}>
                      <th scope="row">{human(field.replace("jobTitle", "job_title"))}</th>
                      <td>{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className={styles.table}>
                <caption>Company matching, in order</caption>
                <tbody>
                  {Object.values(MATCH_METHOD_LABELS).map((label, index) => (
                    <tr key={label}>
                      <th scope="row" className={styles.mono}>
                        {index + 1}
                      </th>
                      <td>{label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            id="rules"
            title="Rules and scoring"
            lede={
              <p>
                Every lead lands in exactly one lane with exactly one reason. Eligibility rules run
                first, in order, and the first one that fails decides. Then, if the AI policy
                allows, rules based on what the message says. Then the score threshold.
              </p>
            }
          >
            <table className={styles.table}>
              <caption>1. Eligibility rules, in the order they run</caption>
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  <th scope="col">If it fails</th>
                  <th scope="col">Reason shown</th>
                </tr>
              </thead>
              <tbody>
                {DATA_RULES.map((rule) => (
                  <tr key={rule.code}>
                    <th scope="row">{rule.check}</th>
                    <td>{LANE_LABELS[rule.lane]}</td>
                    <td className={styles.muted}>{REASONS[rule.code]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className={styles.table}>
              <caption>2. Message rules, only for trusted AI signals</caption>
              <thead>
                <tr>
                  <th scope="col">The message is</th>
                  <th scope="col">Lane</th>
                  <th scope="col">Reason shown</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">An attempt to instruct the AI (any confidence)</th>
                  <td>{LANE_LABELS.review}</td>
                  <td className={styles.muted}>{REASONS.INJECTION}</td>
                </tr>
                {Object.entries(AI_INTENT_RULES).map(([intent, rule]) =>
                  rule ? (
                    <tr key={intent}>
                      <th scope="row">{INTENT_LABELS[intent as keyof typeof INTENT_LABELS]}</th>
                      <td>{LANE_LABELS[rule.lane]}</td>
                      <td className={styles.muted}>{REASONS[rule.code]}</td>
                    </tr>
                  ) : null,
                )}
                <tr>
                  <th scope="row">Untrusted, and it would change the lane</th>
                  <td>{LANE_LABELS.review}</td>
                  <td className={styles.muted}>{REASONS.AI_UNTRUSTED_CHANGES_LANE}</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.note}>
              Trust depends on the policy dial: {AI_POLICY_LABELS.off.toLowerCase()} (AI ignored),{" "}
              {AI_POLICY_LABELS.high.toLowerCase()}, or {AI_POLICY_LABELS.high_medium.toLowerCase()}
              . Confidence is the model’s own rating, lowered to low when its quotes fail the
              checks.
            </p>

            <h3 className={styles.subTitle}>3. The score</h3>
            <p className={styles.paragraph}>
              Fit ({GROUP_LIMITS.fit.min} to {GROUP_LIMITS.fit.max}) asks whether this is a company
              Larkspur serves. Intent ({GROUP_LIMITS.intent.min} to {GROUP_LIMITS.intent.max}) asks
              whether the person is acting like a buyer now. AI ({signed(GROUP_LIMITS.ai.min)} to{" "}
              {signed(GROUP_LIMITS.ai.max)}) adds what the message says, when trusted. Each group
              can be weighted in the lab; the total is clamped to 0–100. A lead at or above the
              threshold (default {DEFAULT_ROUTING.threshold}) joins the sales queue.
            </p>
            <div className={styles.grid3}>
              <PointsTable
                caption="Fit: industry"
                rows={Object.entries(FIT_POINTS.industry).map(([key, points]) => [
                  key === "unknown"
                    ? "Unknown"
                    : INDUSTRY_LABELS[key as keyof typeof INDUSTRY_LABELS],
                  points,
                ])}
              />
              <PointsTable
                caption="Fit: company size (employees)"
                rows={Object.entries(FIT_POINTS.size).map(([key, points]) => [
                  key === "unknown" ? "Unknown" : SIZE_LABELS[key as keyof typeof SIZE_LABELS],
                  points,
                ])}
              />
              <PointsTable
                caption="Fit: region"
                rows={Object.entries(FIT_POINTS.region).map(([key, points]) => [
                  key === "unknown" ? "Unknown" : REGION_LABELS[key as keyof typeof REGION_LABELS],
                  points,
                ])}
              />
              <PointsTable
                caption="Intent: strongest source"
                rows={Object.entries(INTENT_POINTS.source).map(([key, points]) => [
                  SOURCE_LABELS[key as LeadSource],
                  points,
                ])}
              />
              <PointsTable
                caption={`Intent: activity (capped at ${INTENT_POINTS.behavior.cap}) and recency`}
                rows={[
                  ["Viewed pricing twice or more", INTENT_POINTS.behavior.pricingViewsTwoOrMore],
                  ["Viewed pricing once", INTENT_POINTS.behavior.pricingViewsOne],
                  [
                    "Read the docs three times or more",
                    INTENT_POINTS.behavior.docsVisitsThreeOrMore,
                  ],
                  ["Attended a webinar", INTENT_POINTS.behavior.webinarAttended],
                  ["Clicked two or more emails", INTENT_POINTS.behavior.emailClicksTwoOrMore],
                  ["Active within 3 days", INTENT_POINTS.recency.withinThreeDays],
                  ["Active within 7 days", INTENT_POINTS.recency.withinSevenDays],
                ]}
              />
              <PointsTable
                caption={`AI, when trusted (${signed(AI_POINTS.min)} to ${signed(AI_POINTS.max)})`}
                rows={[
                  ["Evaluating a solution", AI_POINTS.intent.evaluating_solution],
                  ["Timeline: within 30 days", AI_POINTS.timeline.within_30_days],
                  ["Timeline: 1 to 3 months", AI_POINTS.timeline.one_to_three_months],
                  ["Timeline: over 3 months", AI_POINTS.timeline.over_three_months],
                  ["Budget approved", AI_POINTS.budget.approved],
                  ["Budget in planning", AI_POINTS.budget.in_planning],
                  ["Budget constrained", AI_POINTS.budget.constrained],
                  ["Asked for a demo", AI_POINTS.nextStep.demo],
                  ["Asked for pricing", AI_POINTS.nextStep.pricing],
                  ["Asked for a call", AI_POINTS.nextStep.call],
                ]}
              />
            </div>
            <h3 className={styles.subTitle}>4. The queue</h3>
            <p className={styles.paragraph}>
              Leads in the sales lane are ordered ({QUEUE_ORDER_LABELS.score.toLowerCase()} by
              default, or {QUEUE_ORDER_LABELS.arrival.toLowerCase()}), with ties broken by arrival
              time and then lead ID so the order is stable. The first {DEFAULT_ROUTING.capacity}{" "}
              (the capacity dial) get a call this week; the rest wait.
            </p>
          </Section>

          <Section
            id="sql"
            title="Data model and SQL"
            lede={
              <p>
                In the browser, the week is loaded into SQLite and the decisions table is rewritten
                every time a dial moves. The answer key sits in its own table and is read only by
                the metric queries.
              </p>
            }
          >
            <details className={styles.details}>
              <summary>Schema: tables and views</summary>
              <pre className={styles.pre}>
                <code>{SCHEMA_SQL.trim()}</code>
              </pre>
            </details>
            <div className={styles.queries}>
              {Object.values(METRIC_QUERIES).map((query) => (
                <details key={query.id} className={styles.details}>
                  <summary>
                    {query.title}
                    <span className={styles.summaryNote}>{query.description}</span>
                  </summary>
                  <pre className={styles.pre}>
                    <code>{query.sql}</code>
                  </pre>
                </details>
              ))}
            </div>
            <p className={styles.note}>
              The same database is open in the lab’s SQL console, under the hood view, for any
              read-only query.
            </p>
          </Section>

          <Section
            id="ai"
            title="The AI contract"
            lede={
              <p>
                One narrow job: read a free-text message and fill in a fixed set of fields, each
                backed by a quote. The model never decides who gets a call, never sees the answer
                key, and in this release never runs on the live site.
              </p>
            }
          >
            <dl className={styles.facts}>
              <div>
                <dt>Model</dt>
                <dd>
                  <code>{DEFAULT_MODEL}</code>, effort <code>{DEFAULT_EFFORT}</code>
                </dd>
              </div>
              <div>
                <dt>Prompt version</dt>
                <dd>
                  <code>{PROMPT_VERSION}</code>
                </dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>
                  Structured output constrained to the schema below, validated again on arrival
                </dd>
              </div>
              <div>
                <dt>Cost control</dt>
                <dd>
                  The run stops at {usd(DEFAULT_MAX_COST_USD)} of estimated spend
                  {price
                    ? `, priced at ${usd(price.input)} per million input tokens and ${usd(price.output)} per million output tokens`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Where the key lives</dt>
                <dd>
                  A GitHub Actions secret. The extraction runs in a workflow, never in the browser
                </dd>
              </div>
              <div>
                <dt>When it runs</dt>
                <dd>
                  Once per prompt or data version; results are stored with model, date and cost
                </dd>
              </div>
            </dl>

            <h3 className={styles.subTitle}>Before the rules may use an answer</h3>
            <ol className={styles.list}>
              <li>
                The answer must match the schema. Refusals, cut-off answers, invalid output and API
                errors are stored as failures, and the lead is treated as if it had no message.
              </li>
              <li>
                Every quote must appear in the message, ignoring case, spacing and curly quotes.
              </li>
              <li>Every field that adds points must have a quote.</li>
              <li>If either check fails, the answer’s confidence drops to low.</li>
              <li>
                The confidence policy decides whether the answer is trusted. An untrusted answer
                that would change the lane sends the lead to human review. A detected prompt
                injection always does.
              </li>
            </ol>

            <details className={styles.details}>
              <summary>The system prompt, in full</summary>
              <pre className={styles.pre}>
                <code>{SYSTEM_PROMPT}</code>
              </pre>
            </details>
            <details className={styles.details}>
              <summary>An example of what the model receives</summary>
              <pre className={styles.pre}>
                <code>{sampleMessage()}</code>
              </pre>
            </details>
            <details className={styles.details}>
              <summary>The JSON schema the answer must fill</summary>
              <pre className={styles.pre}>
                <code>{jsonSchema}</code>
              </pre>
            </details>
            <p className={styles.note}>
              Evaluation: each stored run is scored against the answer key, field by field, by
              confidence level and for prompt injections, and every miss is listed. The scorecard is
              in the <Link href="/lab?view=hood">lab’s under-the-hood view</Link>, and{" "}
              <code>pnpm ai:eval</code> prints the same numbers in a terminal.
            </p>
          </Section>

          <Section
            id="testing"
            title="Tests"
            lede={
              report ? (
                <p>
                  {report.passed} of {report.total} tests in {report.files.length} files passed in
                  the test run of {formatDate(report.ranAt)}, which this page reads when it is
                  built. Tests run in CI on every push and again before every production build, and
                  the build stops if one fails. Property tests (fast-check) try hundreds of random
                  leads and settings against rules that must always hold.
                </p>
              ) : (
                <p>
                  No test report was found at <code>{TEST_REPORT_PATH}</code>, so no results are
                  shown. Production builds write it with <code>pnpm test:report</code> before they
                  start.
                </p>
              )
            }
          >
            {report ? (
              <div className={styles.tests}>
                {report.files.map((file) => {
                  const failed = file.tests.filter((test) => test.status === "failed").length;
                  return (
                    <details key={file.path} className={styles.details}>
                      <summary>
                        <code>{file.path}</code>
                        <span className={styles.summaryNote}>
                          {file.tests.length} {file.tests.length === 1 ? "test" : "tests"}
                          {failed > 0 ? `, ${failed} failed` : ""}
                        </span>
                      </summary>
                      <ul className={styles.testList}>
                        {file.tests.map((test) => (
                          <li key={test.name} data-status={test.status}>
                            <span className="visually-hidden">{test.status}: </span>
                            {test.name}
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            ) : null}
          </Section>

          <Section id="decisions" title="Decisions and trade-offs">
            <ol className={styles.decisions}>
              {DECISIONS.map((decision, index) => (
                <li key={decision.title} className={styles.decision}>
                  <h3 className={styles.decisionTitle}>
                    <span className={styles.mono}>{String(index + 1).padStart(2, "0")}</span>{" "}
                    {decision.title}
                  </h3>
                  <dl>
                    <div>
                      <dt>Context</dt>
                      <dd>{decision.context}</dd>
                    </div>
                    <div>
                      <dt>Decision</dt>
                      <dd>{decision.decision}</dd>
                    </div>
                    <div>
                      <dt>Consequence</dt>
                      <dd>{decision.consequence}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="limitations" title="Known limitations">
            <ul className={styles.list}>
              {LIMITATIONS.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
            <p className={styles.note}>
              Source code, setup and deployment notes:{" "}
              <a href={SITE.repository}>{SITE.repository}</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
