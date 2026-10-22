import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DEFAULT_MODEL } from "@/core/ai/config";
import { PROMPT_VERSION } from "@/core/ai/prompt";
import { GENERATOR_VERSION } from "@/core/dataset/generate";
import { buildInfo } from "@/lib/server/build-info";
import { readAiRun, readManifest } from "@/lib/server/week-files";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Colophon",
  description:
    "What is real on this site and what is simulated, how AI is used, what the site is built with, and how it treats your privacy.",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

const major = (version: string | undefined) => version?.replace(/^[^\d]*/, "") ?? "";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={`prose ${styles.prose}`}>{children}</div>
    </section>
  );
}

export default function ColophonPage() {
  const build = buildInfo();
  const runs = readManifest()
    .weeks.map((week) => ({ week, run: readAiRun(week.id) }))
    .filter((entry) => entry.run !== null);
  const v = build.versions;
  const stack: Array<[string, string]> = [
    ["Framework", `Next.js ${major(v.next)} and React ${major(v.react)}, every page pre-rendered`],
    ["Language", "TypeScript in strict mode"],
    [
      "Database in the browser",
      `SQLite compiled to WebAssembly, through sql.js ${major(v["sql.js"])}`,
    ],
    ["Schemas and validation", `Zod ${major(v.zod)}`],
    ["AI", `Anthropic API with ${DEFAULT_MODEL}, offline only`],
    ["Tests", "Vitest, fast-check, Playwright and axe-core"],
    ["Linting and formatting", "Biome"],
    ["Type", "Schibsted Grotesk, Source Serif 4 and IBM Plex Mono, served from this site"],
  ];

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">Colophon</p>
        <h1 className={styles.title}>How this site is made</h1>
        <p className={styles.lede}>
          What is real here and what is simulated, how AI is used, what the site is built with, and
          what it does with your data, which is nothing.
        </p>
      </header>

      <Section id="real" title="What is real and what is simulated">
        <p>
          The <Link href="/lab">Decision Lab</Link> is a working system. Its cleaning, rules,
          scoring, SQL and tests run exactly as published{" "}
          <Link href="/architecture">under the hood</Link>.
        </p>
        <p>
          Its data is synthetic. Larkspur is a fictional company, and every person, company and
          message in the lab was produced by a seeded generator. Outcomes are counted against the
          generator’s answer key, so the lab is a backtest of the rules, not a forecast of any
          market.
        </p>
        <p>
          It is a personal, independent demonstration. It has not been used in production, and it is
          not a copy of any employer’s or client’s system.
        </p>
      </Section>

      <Section id="ai" title="AI on this site">
        {runs.length > 0 ? (
          <>
            <p>
              Messages in the lab were read by a model offline, and the answers are stored with the
              run that produced them:
            </p>
            <ul>
              {runs.map(({ week, run }) =>
                run ? (
                  <li key={week.id}>
                    {week.label}: <code>{run.model}</code> at effort <code>{run.effort}</code>,
                    prompt <code>{run.promptVersion}</code>, generated on{" "}
                    {formatDate(run.generatedAt)}, {run.results.length} messages, estimated cost $
                    {run.usage.estimatedCostUsd.toFixed(2)}.
                  </li>
                ) : null,
              )}
            </ul>
            <p>
              Every AI output in the lab is labeled as stored. The site never calls a model while
              you browse.
            </p>
            <p>
              An earlier run, with prompt <code>2026-10-20.1</code>, was replaced: its answers often
              had no quote for intent, so the checks set a quarter of them to low confidence. Both
              runs’ scorecards are in the{" "}
              <a href={`${SITE.repository}/blob/main/docs/TESTING.md#stored-runs`}>testing notes</a>
              .
            </p>
          </>
        ) : (
          <p>
            No model outputs are published yet. Extraction runs offline, in a GitHub workflow that
            keeps the API key out of the site. Until it has run, the lab’s AI dial is off, and the
            only AI comparison it shows uses the answer key to show what perfect message reading
            would change. The site never calls a model while you browse.
          </p>
        )}
      </Section>

      <Section id="built" title="How it was built">
        <p>
          I wrote the brief, set the scope and the standards, and approved the design and product
          decisions. Most of the code was written with Claude Code, an AI coding assistant, under my
          direction. It is held to the same tests and published rules as any other code.
        </p>
      </Section>

      <section className={styles.section} aria-labelledby="stack-title">
        <h2 id="stack-title" className={styles.sectionTitle}>
          Built with
        </h2>
        <dl className={styles.facts}>
          {stack.map(([term, detail]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section id="privacy" title="Privacy">
        <p>
          No cookies, no analytics and no tracking. Pages make no requests to other sites: fonts are
          served from this site, and the content security policy blocks anything else. The lab runs
          in your browser, and nothing you change in it is sent anywhere.
        </p>
      </Section>

      <Section id="accessibility" title="Accessibility">
        <p>
          Pages are designed to meet WCAG 2.2 at level AA. They work with a keyboard, follow your
          light or dark setting, respect reduced motion and fit a phone screen. Charts have a table
          view, and color is never the only signal. Automated accessibility checks (axe) run on
          every page in the end-to-end tests.
        </p>
        <p>
          If something does not work for you, please <Link href="/about#contact">get in touch</Link>
          .
        </p>
      </Section>

      <section className={styles.section} aria-labelledby="build-title">
        <h2 id="build-title" className={styles.sectionTitle}>
          This version
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>Built</dt>
            <dd>{formatDate(build.builtAt)}</dd>
          </div>
          {build.commit ? (
            <div>
              <dt>Commit</dt>
              <dd>
                <a href={`${SITE.repository}/commit/${build.commit}`}>
                  <code>{build.commit.slice(0, 7)}</code>
                </a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Data generator</dt>
            <dd>Version {GENERATOR_VERSION}</dd>
          </div>
          <div>
            <dt>Extraction prompt</dt>
            <dd>
              <code>{PROMPT_VERSION}</code>
            </dd>
          </div>
          <div>
            <dt>Source code</dt>
            <dd>
              <a href={SITE.repository}>{SITE.repository.replace("https://", "")}</a>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
