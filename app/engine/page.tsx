import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChecksTable } from "@/components/flow/inside/ChecksTable";
import { Lifecycle } from "@/components/flow/Lifecycle";
import { BASE, LEVER_IDS, STATION_IDS } from "@/core/flow/company";
import { QUARTER_DAYS, WARMUP_DAYS } from "@/core/flow/experiment";
import { runChecks } from "@/core/flow/validate";
import { assumptionGroups } from "@/lib/flow/assumptions";
import { percent } from "@/lib/flow/format";
import { RUNS } from "@/lib/flow/view";
import { buildInfo } from "@/lib/server/build-info";
import { readTestReport } from "@/lib/server/tests";
import { SITE } from "@/site.config";
import table from "../../components/flow/Inside.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "How it is built",
  description:
    "The model behind the page: what it computes, what it assumes, how it was checked and where it stops being true.",
};

/** Customers per queue for the checks shown here. The home page reruns them in the browser. */
const CHECK_CUSTOMERS = 100_000;

const SECTIONS = [
  ["real", "Real and made up"],
  ["states", "The life of a request"],
  ["method", "Five decisions"],
  ["page", "How the page computes"],
  ["ai", "The AI step"],
  ["assumptions", "Every assumption"],
  ["checks", "How it was checked"],
  ["limits", "Where it stops being true"],
  ["company", "At a real company"],
  ["built", "Built with"],
] as const;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

const major = (version: string | undefined) => version?.replace(/^[^\d]*/, "").split(".")[0] ?? "";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function EnginePage() {
  const a = BASE;
  const tests = readTestReport();
  const build = buildInfo();
  const checks = runChecks(CHECK_CUSTOMERS);
  const agree = checks.filter((check) => check.pass).length;
  const combinations = 2 ** LEVER_IDS.length;
  const source = (path: string) => `${SITE.repository}/blob/main/${path}`;

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">How it is built</p>
        <h1 className={styles.title}>The model behind the page</h1>
        <p className={styles.lede}>
          The home page is a simulation that runs in your browser, not a recording. This is its
          manual: what it computes, what it assumes, how it was checked and where it stops being
          true.
        </p>
        <nav aria-label="On this page">
          <ul className={styles.toc}>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Section id="real" title="What runs for real, and what is made up">
        <div className={styles.split}>
          <div>
            <h3 className={styles.kicker} data-tone="good">
              Runs for real
            </h3>
            <dl className={styles.list}>
              <div>
                <dt>The simulation</dt>
                <dd>
                  Every dot, wait and dollar on the home page is computed on your device, again each
                  time you change something.
                </dd>
              </div>
              <div>
                <dt>The comparison</dt>
                <dd>
                  Each change is measured against today's company on the same simulated customers,
                  over {RUNS} quarters.
                </dd>
              </div>
              <div>
                <dt>The checks</dt>
                <dd>
                  The engine is tested against queueing formulas with known answers. You can rerun
                  that test yourself under “Check the math”.
                </dd>
              </div>
              <div>
                <dt>The AI step</dt>
                <dd>
                  Your own request is a live call to Claude. The four samples replay real runs,
                  recorded once.
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className={styles.kicker}>Made up, and labeled so</h3>
            <dl className={styles.list}>
              <div>
                <dt>Larkspur and its customers</dt>
                <dd>No real company's data is used anywhere on this site.</dd>
              </div>
              <div>
                <dt>The assumptions</dt>
                <dd>
                  Chosen to be plausible for a small software company, not measured. All of them are{" "}
                  <a href="#assumptions">listed below</a>, and seven can be changed on the home
                  page.
                </dd>
              </div>
              <div>
                <dt>The dollar figures</dt>
                <dd>
                  They follow from the assumptions. They show how the method reasons; they are not
                  results achieved anywhere.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section id="states" title="The life of a request">
        <div className={styles.states}>
          <Lifecycle />
          <dl className={styles.rules}>
            <div>
              <dt>The hand-out</dt>
              <dd>
                Only the sales desk holds requests. Today a manager hands out the inbox once a day,
                at 9:00. With assignment rules, a request reaches its owner the moment it arrives.
              </dd>
            </div>
            <div>
              <dt>A free person</dt>
              <dd>
                Each person handles one request at a time, in the order they arrived. A team that
                gives this work two hours of its nine-hour day finishes a one-hour job four and a
                half working hours after starting it.
              </dd>
            </div>
            <div>
              <dt>Patience</dt>
              <dd>
                Every customer has a limit at each step, counted in calendar time, so nights and
                weekends count. Half of those waiting for a first reply are gone after{" "}
                {a.patienceDays.reply} days.
              </dd>
            </div>
            <div>
              <dt>Sent back</dt>
              <dd>
                {percent(a.invoiceErrorShare)} of hand-typed invoices have a mistake. The customer
                disputes it, and {a.disputeDays} days later it is back on the clerk's desk.
              </dd>
            </div>
            <div>
              <dt>The customer decides</dt>
              <dd>
                {percent(1 - a.fitShare)} of requests come from companies Larkspur cannot serve, and
                get a polite no. Of the rest, {percent(a.acceptShare)} accept the quote and{" "}
                {percent(a.signShare)} of those sign. That is decided per customer before anyone
                waits, so waiting never changes who would have bought: it only decides who is still
                there.
              </dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>
                A correct invoice is paid after {a.paymentDays} days, half of them sooner and half
                later.
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section id="method" title="Five decisions that make the numbers worth reading">
        <ol className={styles.decisions}>
          <li>
            <h3>Time moves from event to event</h3>
            <p>
              Nothing is rounded to days or ticks. A reply that takes four minutes takes four
              minutes, and a quiet weekend costs nothing to simulate.{" "}
              <a href={source("core/flow/engine.ts")}>engine.ts</a>
            </p>
          </li>
          <li>
            <h3>Chance belongs to the customer</h3>
            <p>
              Each request carries a key, and everything luck decides about it is a fixed function
              of that key: how long it will wait, how long its quote takes, whether its invoice has
              a mistake. Two versions of the company therefore meet the same customers with the same
              luck, and a difference between them was caused by how they work.{" "}
              <a href={source("core/flow/chance.ts")}>chance.ts</a>
            </p>
          </li>
          <li>
            <h3>{RUNS} quarters, never one</h3>
            <p>
              Every figure is the average of {RUNS} simulated quarters of {QUARTER_DAYS} working
              days, each started {WARMUP_DAYS} days early so it opens with work in progress, and
              shown with the range eight in ten of them fall inside. A change is called worth it
              only when its average gain after cost is more than two standard errors from zero.
              Otherwise the page says it is too close to call.{" "}
              <a href={source("core/flow/experiment.ts")}>experiment.ts</a>
            </p>
          </li>
          <li>
            <h3>Every change does one thing</h3>
            <p>
              Assignment rules remove the wait for the hand-out. AI drafting shortens a reply from{" "}
              {a.touchMinutes.reply} minutes to {a.draftedReplyMinutes}. Nothing assumes that a tool
              makes customers buy more. If a change pays, it is because a line got shorter.{" "}
              <a href={source("core/flow/company.ts")}>company.ts</a>
            </p>
          </li>
          <li>
            <h3>The plan is worked out again after every step</h3>
            <p>
              The best next change depends on what was already changed, because fixing one team
              moves the line to the next. The planner tries every open change from wherever the
              company stands, takes the one that leaves most after its own cost, and looks again. A
              test compares where it ends with all {combinations} combinations of the{" "}
              {LEVER_IDS.length} improvements: it must land within 3% of the best.{" "}
              <a href={source("core/flow/planner.ts")}>planner.ts</a>
            </p>
          </li>
        </ol>
      </Section>

      <Section id="page" title="How the page computes">
        <ul className={styles.points}>
          <li>
            The first screen is worked out when the site is built: today's company, every option and
            the whole plan, more than 3,000 simulated quarters. It arrives as part of the page, so
            there is nothing to wait for before reading it.
          </li>
          <li>
            Everything you change is simulated on your device, in up to four background workers, and
            kept, so going back is instant. Without workers it runs on the main thread, more slowly.
          </li>
          <li>
            The floor is the same engine moved forward in small steps and drawn on a canvas. Its
            labels and buttons are ordinary HTML laid over the drawing, and the same information is
            in a table under “Why the line forms”.
          </li>
          <li>
            What you set lives in the address bar, so a link opens the same company with the same
            changes on any device.
          </li>
          <li>
            No cookies, no analytics, no requests to other sites. Fonts are served from this one.
          </li>
        </ul>
      </Section>

      <Section id="ai" title="The AI step">
        <ul className={styles.points}>
          <li>
            One model call per request. The answer has to come back through a tool with a strict
            format: what the person wants, how urgent it is, how well the company fits, who should
            own it and by which rule, a reply, a CRM note and what to check before sending. An
            answer in any other shape is rejected.{" "}
            <a href={source("core/agent/contract.ts")}>contract.ts</a>
          </li>
          <li>
            A person approves, edits or rejects every reply. Nothing is sent anywhere. The model is
            told that the request's text is data, not instructions.
          </li>
          <li>
            The key stays on the server. Requests must come from this site, and are limited to five
            an hour per visitor and to a daily total.{" "}
            <a href={source("app/api/agent/route.ts")}>route.ts</a>
          </li>
          <li>
            What you write is sent to Anthropic's API to produce the reply. This site does not store
            it.
          </li>
          <li>
            If the live agent is switched off or a limit is reached, the page says so, and the
            recorded runs keep working.
          </li>
          <li>
            In the simulation this step does exactly one thing: a reply takes{" "}
            {a.draftedReplyMinutes} minutes of a rep's time instead of {a.touchMinutes.reply}, and
            each draft costs ${a.costPerDraft.toFixed(2)} of model usage.
          </li>
        </ul>
      </Section>

      <Section id="assumptions" title="Every assumption">
        <p className={styles.text}>
          These are all the numbers the model takes as given. The home page lets you move the seven
          that matter most and shows how far the result moves with each.
        </p>
        <table className={`${table.table} ${styles.assumptions}`}>
          {assumptionGroups(a).map((group) => (
            <tbody key={group.title}>
              <tr>
                <th scope="colgroup" colSpan={2} className={styles.group}>
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </Section>

      <Section id="checks" title="How it was checked">
        <h3 className={styles.subhead}>Against mathematics</h3>
        <p className={styles.text}>
          A simulation can look right and be wrong. The same engine that runs Larkspur is run on
          four simple queues that have exact formulas, {CHECK_CUSTOMERS.toLocaleString("en-US")}{" "}
          customers each. When this page was built, {agree} of {checks.length} comparisons agreed.
        </p>
        <ChecksTable checks={checks} />

        <h3 className={styles.subhead}>By automated tests</h3>
        {tests ? (
          <>
            <p className={styles.text}>
              {tests.passed.toLocaleString("en-US")} of {tests.total.toLocaleString("en-US")} tests
              passed{tests.failed > 0 ? `, ${tests.failed} failed` : ""} on{" "}
              {formatDate(tests.ranAt)}, before this version was built. They are written as plain
              statements about the company, so the list reads as a specification.
            </p>
            <ul className={styles.files}>
              {tests.files.map((file) => (
                <li key={file.path}>
                  <details>
                    <summary>
                      <code>{file.path}</code>
                      <span className={styles.tally}>
                        {file.tests.filter((test) => test.status === "passed").length} of{" "}
                        {file.tests.length} passed
                      </span>
                    </summary>
                    <ul>
                      {file.tests.map((test) => (
                        <li key={test.name} data-status={test.status}>
                          {test.name}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.text}>
            The test report is written when the site is built for release. This copy was not built
            that way, so there is no report to show.
          </p>
        )}

        <h3 className={styles.subhead}>In a browser</h3>
        <p className={styles.text}>
          A second set of tests drives the finished page on a desktop and on a phone: it makes the
          first change, compares the figures on the screen with the engine's own, reopens a setup
          from its link, scans for accessibility problems in light and dark, and fails if the page
          sets a cookie or contacts another site.{" "}
          <a href={`${SITE.repository}/tree/main/tests/e2e`}>tests/e2e</a>
        </p>
      </Section>

      <Section id="limits" title="Where it stops being true">
        <ul className={styles.points}>
          <li>
            Larkspur is not fitted to any real company. Using this on a real one starts by replacing
            the assumptions with its own records: when requests arrive, how long each step takes,
            how long customers wait before they go elsewhere.
          </li>
          <li>
            Patience is the assumption the result leans on most, and the hardest to measure in real
            life. The test under “Change the assumptions” shows how far the answer moves with it.
          </li>
          <li>
            People here do not learn, tire, help the next team or juggle several things. Each one
            does one job at a time at a steady pace.
          </li>
          <li>
            A change works in full from the moment it is switched on. Rollout, training and adoption
            are not modeled, which is why payback is only given roughly.
          </li>
          <li>
            Demand does not react. Faster replies do not bring more requests, and customers who gave
            up do not come back.
          </li>
          <li>
            Results repeat exactly on one browser engine. Another engine may round the last digit of
            a logarithm differently, which can move a figure very slightly. The first screen is
            computed when the site is built; everything after it, in your browser.
          </li>
        </ul>
      </Section>

      <Section id="company" title="At a real company">
        <p className={styles.text}>
          The simulation is the small part. The same method on real work goes in five steps.
        </p>
        <ol className={styles.steps}>
          <li>
            <strong>Measure the flow.</strong> Pull the timestamps a CRM and a billing system
            already keep: when each request arrived, when it was picked up, when it moved on, when
            it was paid or lost.
          </li>
          <li>
            <strong>Find the wait.</strong> For each step, separate time spent working from time
            spent waiting, and waiting for a person from waiting for a hand-off.
          </li>
          <li>
            <strong>Rank the fixes.</strong> Put the company's own numbers into a model like this
            one and compare changes on the same customers before building anything.
          </li>
          <li>
            <strong>Build the first one.</strong> Usually in tools the company already has:
            assignment rules and workflows in a CRM such as HubSpot or Zoho, automations in n8n,
            Make or Zapier, data work in SQL and Python, and a model such as Claude where a step
            needs judgment, with a person approving.
          </li>
          <li>
            <strong>Check it against the forecast.</strong> Compare what happened with what the
            model said, and correct the model before the next change.
          </li>
        </ol>
      </Section>

      <Section id="built" title="Built with">
        <dl className={styles.facts}>
          <div>
            <dt>Model</dt>
            <dd>
              TypeScript in strict mode, no dependencies. The {STATION_IDS.length}-team company, the
              engine and the statistics live in <code>core/flow</code> and import nothing from the
              interface; a test keeps it that way.
            </dd>
          </div>
          <div>
            <dt>Interface</dt>
            <dd>
              Next.js {major(build.versions.next)} and React {major(build.versions.react)}: two
              static pages and one server route. Canvas for the floor, plain HTML and CSS for
              everything else.
            </dd>
          </div>
          <div>
            <dt>AI</dt>
            <dd>The Claude API, called from the server route only.</dd>
          </div>
          <div>
            <dt>Tests</dt>
            <dd>
              Vitest and fast-check for the model, Playwright and axe for the page, Biome for
              formatting and static checks.
            </dd>
          </div>
          <div>
            <dt>This version</dt>
            <dd>
              {build.commit ? (
                <>
                  Commit{" "}
                  <a href={`${SITE.repository}/commit/${build.commit}`}>
                    <code>{build.commit.slice(0, 7)}</code>
                  </a>
                  , built on {formatDate(build.builtAt)}.{" "}
                </>
              ) : (
                <>Built on {formatDate(build.builtAt)}. </>
              )}
              <a href={SITE.repository}>Read the source</a>.
            </dd>
          </div>
        </dl>
        <p className={styles.back}>
          <Link href="/">Back to the company</Link>
        </p>
      </Section>
    </div>
  );
}
