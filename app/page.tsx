import Link from "next/link";
import { ContactLinks } from "@/components/ContactLinks";
import { AgentDemo } from "@/components/gtm/AgentDemo";
import { LeadStory } from "@/components/home/LeadStory";
import { RESPONSE_STUDY } from "@/content/benchmarks";
import { SKILLS } from "@/content/skills";
import { TEAM } from "@/core/gtm/model";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

/** Leads a month used to turn minutes saved per lead into hours a month. */
const EXAMPLE_LEADS_PER_MONTH = 300;
const minutesSaved = TEAM.manualMinutes - TEAM.aiMinutes;
const hoursBack = Math.round((minutesSaved * EXAMPLE_LEADS_PER_MONTH) / 60);

const VALUE = [
  {
    figure: `${RESPONSE_STUDY.averageReplyHours} h`,
    text: `is how long the average company takes to answer a lead from its website. ${Math.round(RESPONSE_STUDY.neverReplied * 100)}% never answer.`,
  },
  {
    figure: `≈${RESPONSE_STUDY.withinHourMultiple}×`,
    text: "more likely to get a real conversation with a decision maker when the reply comes within the hour instead of an hour later.",
  },
  {
    figure: `${minutesSaved} min`,
    text: `saved on every lead: about ${TEAM.manualMinutes} minutes to research and write a first reply by hand, ${TEAM.aiMinutes} to check an AI draft. At ${EXAMPLE_LEADS_PER_MONTH} leads a month, ${hoursBack} hours back.`,
  },
];

const PROCESS = [
  {
    title: "Measure",
    text: "Find where leads wait or get lost, and what that costs. One page of numbers.",
  },
  {
    title: "Build",
    text: "Fix what is worth the most first, in the tools your team already uses.",
  },
  {
    title: "Prove",
    text: "Compare against a control group and report the change in meetings and money.",
  },
];

const MORE = [
  {
    href: "/simulator",
    title: "GTM simulator",
    text: "Switch automations on and off over 90 days of made-up leads and see which one pays most.",
  },
  {
    href: "/lab",
    title: "Decision Lab",
    text: "Lead scoring with every rule and every SQL query in view.",
  },
  {
    href: "/architecture",
    title: "How this site is built",
    text: "Requirements, tests and design decisions behind these demos.",
  },
];

export default function Home() {
  return (
    <>
      <section className={`page ${styles.hero}`} aria-labelledby="home-title">
        <div className={styles.intro}>
          <p className={styles.role}>GTM engineer · RevOps · AI automation</p>
          <h1 id="home-title" className={styles.claim}>
            I build systems that turn leads into sales meetings.
          </h1>
          <p className={styles.subclaim}>
            When a potential customer writes to your company, the right salesperson gets it in
            seconds, with a reply already drafted. A person approves before anything is sent.
          </p>
          <ul className={styles.specialties} aria-label="Skills">
            {SITE.specialties.map((specialty) => (
              <li key={specialty}>{specialty}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <a href="#agent" className="button" data-variant="primary">
              Try it now
            </a>
            <Link href="/about#contact" className="button" data-variant="quiet">
              Get in touch
            </Link>
          </div>
        </div>
        <div className={styles.visual}>
          <LeadStory />
        </div>
      </section>

      <section className={`page ${styles.section}`} id="agent" aria-labelledby="agent-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Try it · 10 seconds</p>
          <h2 id="agent-title" className={styles.sectionTitle}>
            Answer a new lead the way my systems do.
          </h2>
          <ol className={styles.howTo}>
            <li>Pick a message from the inbox.</li>
            <li>Press “Let the agent handle it”.</li>
            <li>Check the reply and approve it.</li>
          </ol>
          <p className={styles.sectionNote}>
            A made-up company and its leads. The AI runs are real, recorded so the demo is instant.
          </p>
        </header>
        <AgentDemo worth={{ manualWaitHours: RESPONSE_STUDY.averageReplyHours }} />
      </section>

      <section className={`page ${styles.section}`} id="value" aria-labelledby="value-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">What it is worth</p>
          <h2 id="value-title" className={styles.sectionTitle}>
            Every hour a lead waits costs you meetings.
          </h2>
        </header>
        <ul className={styles.values}>
          {VALUE.map((item) => (
            <li key={item.figure} className={styles.value}>
              <span className={styles.valueFigure}>{item.figure}</span>
              <span className={styles.valueText}>{item.text}</span>
            </li>
          ))}
        </ul>
        <p className={styles.sectionNote}>
          First two figures:{" "}
          <a href={RESPONSE_STUDY.url} rel="noopener noreferrer">
            {RESPONSE_STUDY.publication}, “{RESPONSE_STUDY.title}”
          </a>
          , {RESPONSE_STUDY.date}. Minutes per lead: an estimate.
        </p>
      </section>

      <section className={`page ${styles.section}`} id="build" aria-labelledby="build-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">What I build</p>
          <h2 id="build-title" className={styles.sectionTitle}>
            Systems I can set up for your sales team.
          </h2>
        </header>
        <ul className={styles.build}>
          {SKILLS.map((skill) => (
            <li key={skill.id} className={styles.buildItem}>
              <h3 className={styles.buildName}>{skill.name}</h3>
              <p className={styles.buildPlain}>{skill.plain}</p>
              <p className={styles.buildTools}>{skill.tools.join(" · ")}</p>
              {skill.see.href.startsWith("/") ? (
                <Link href={skill.see.href} className={styles.buildLink}>
                  {skill.see.label} →
                </Link>
              ) : (
                <a href={skill.see.href} className={styles.buildLink}>
                  {skill.see.label} ↑
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={`page ${styles.section}`} id="how" aria-labelledby="how-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">How I work</p>
          <h2 id="how-title" className={styles.sectionTitle}>
            Measure, build, prove.
          </h2>
        </header>
        <ol className={styles.process}>
          {PROCESS.map((step, index) => (
            <li key={step.title} className={styles.processStep}>
              <span className={`num ${styles.processNum}`}>{index + 1}</span>
              <h3 className={styles.processTitle}>{step.title}</h3>
              <p className={styles.processText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`page ${styles.section}`} id="more" aria-labelledby="more-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Go deeper</p>
          <h2 id="more-title" className={styles.sectionTitle}>
            More demos.
          </h2>
        </header>
        <ul className={styles.more}>
          {MORE.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={styles.moreItem}>
                <span className={styles.moreTitle}>{item.title} →</span>
                <span className={styles.moreText}>{item.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={`page ${styles.section} ${styles.contact}`}
        aria-labelledby="contact-title"
      >
        <div>
          <h2 id="contact-title" className={styles.sectionTitle}>
            Get in touch
          </h2>
          <p className={styles.contactText}>Let&rsquo;s look at your numbers together.</p>
        </div>
        <ContactLinks />
      </section>
    </>
  );
}
