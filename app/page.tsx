import Link from "next/link";
import { ContactLinks } from "@/components/ContactLinks";
import { AgentDemo } from "@/components/gtm/AgentDemo";
import { Diagnose } from "@/components/gtm/Diagnose";
import { HeroEngine } from "@/components/gtm/HeroEngine";
import { Simulator } from "@/components/gtm/Simulator";
import { PLAYBOOKS } from "@/content/playbooks";
import { SKILLS } from "@/content/skills";
import { ALL_OFF, AUTOMATIONS } from "@/core/gtm/model";
import { simulate } from "@/core/gtm/simulate";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

/** Headline figures. The first two are cleared, program-level results; never one person's. */
const STATS = [
  {
    value: "≈60%",
    label: "higher contract value than the control group, in an A/B test",
  },
  {
    value: "≈26%",
    label: "of contacted leads surfaced a need that later closed as a contract",
  },
  {
    value: "2",
    label: "AI and CRM systems I designed, running in production",
  },
];

/** Real systems, in the words of the problem they solve. No confidential detail. */
const SYSTEMS = [
  {
    where: "BairesDev · strategic lead program",
    problem: "Which leads deserve a salesperson’s time?",
    built:
      "Lead scoring, the context for each lead and AI-drafted messages that a person approves. Every result is measured against a control group.",
    result: "≈60% higher contract value than the control group. A program result.",
    tools: ["SQL", "Databricks", "n8n", "RAG", "LLM agents"],
    see: { label: "Try a version of it", href: "#agent" },
  },
  {
    where: "BairesDev · Office of the CEO",
    problem: "Executive messages and opportunities lost in spreadsheets.",
    built:
      "An AI app that sorts incoming messages and routes each opportunity to the right person. It now runs on the company’s production database.",
    result: "In production.",
    tools: ["AI classification", "Opportunity routing", "Network analysis"],
    see: { label: "Read more", href: "/work#bairesdev" },
  },
  {
    where: "Sintropia · Co-founder and CTO",
    problem: "A healthcare company’s leads and follow-ups spread across tools.",
    built:
      "One CRM from first contact to follow-up: lead capture, workflows, integrations and automation, designed and delivered end to end.",
    result: "In production.",
    tools: ["CRM", "Automation", "Integrations"],
    see: { label: "Read more", href: "/work#sintropia" },
  },
];

/** How an engagement runs, phase by phase, with what the team gets at the end of each. */
const PLAN = [
  {
    when: "Days 1–30",
    title: "Measure",
    does: "Map every step from first contact to closed deal. Measure how fast leads get an answer, and which sources turn into meetings.",
    get: "One page of numbers, and the three changes worth the most, priced in dollars.",
  },
  {
    when: "Days 31–60",
    title: "Ship the first fix",
    does: "Usually routing and scoring: every lead reaches the right person within minutes, best leads first. A control group stays aside.",
    get: "A working system, and proof against the control group, not a guess.",
  },
  {
    when: "Days 61–90",
    title: "Add AI, a person in charge",
    does: "Drafted replies and CRM notes that a rep approves before anything is sent. Every action is logged.",
    get: "A report in meetings and dollars, and what to build next.",
  },
];

const manualInbound = simulate("inbound", ALL_OFF);

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
            Lead scoring, routing and AI agents that draft while a person approves. Measured against
            a control group, so the result is proven.
          </p>
          <dl className={styles.stats}>
            {STATS.map((stat) => (
              <div key={stat.value} className={styles.stat}>
                <dt className={`num ${styles.statValue}`}>{stat.value}</dt>
                <dd className={styles.statLabel}>{stat.label}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.statNote}>
            The first two are results of the BairesDev lead program as a whole, where I run the
            automation and decision layer.
          </p>
          <ul className={styles.specialties} aria-label="Skills">
            {SITE.specialties.map((specialty) => (
              <li key={specialty}>{specialty}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <a href="#proof" className="button" data-variant="primary">
              See the systems
            </a>
            <a href="#agent" className="button">
              Try the AI agent
            </a>
            <Link href="/about#contact" className="button" data-variant="quiet">
              Get in touch
            </Link>
          </div>
        </div>
        <div className={styles.visual}>
          <HeroEngine />
        </div>
      </section>

      <section className={`page ${styles.section}`} id="proof" aria-labelledby="proof-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Real work</p>
          <h2 id="proof-title" className={styles.sectionTitle}>
            Systems I run today.
          </h2>
        </header>
        <ol className={styles.what}>
          {SYSTEMS.map((item) => (
            <li key={item.problem} className={styles.whatItem}>
              <p className="eyebrow">{item.where}</p>
              <p className={styles.whatProblem}>{item.problem}</p>
              <p className={styles.whatFix}>{item.built}</p>
              <p className={styles.whatImpact}>{item.result}</p>
              <ul className={styles.tools} aria-label="Tools and methods">
                {item.tools.map((tool) => (
                  <li key={tool} className="tag">
                    {tool}
                  </li>
                ))}
              </ul>
              {item.see.href.startsWith("/") ? (
                <Link href={item.see.href} className={styles.whatLink}>
                  {item.see.label} →
                </Link>
              ) : (
                <a href={item.see.href} className={styles.whatLink}>
                  {item.see.label} ↓
                </a>
              )}
            </li>
          ))}
        </ol>
        <p className={styles.more}>
          Confidential systems: nothing on this site is taken from them. The demos below use made-up
          data. <Link href="/work">All my work</Link>
        </p>
      </section>

      <section className={`page ${styles.section}`} id="agent" aria-labelledby="agent-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">See it working · AI agent</p>
          <h2 id="agent-title" className={styles.sectionTitle}>
            A new lead, answered in seconds. A person approves.
          </h2>
          <p className={styles.sectionLede}>
            The same pattern as the lead program above, on made-up leads. Pick a message: the agent
            decides who should answer and drafts the reply. Real runs, recorded.
          </p>
        </header>
        <AgentDemo worth={{ manualWaitHours: manualInbound.medianHoursToTouch }} />
      </section>

      <section className={`page ${styles.section}`} id="plan" aria-labelledby="plan-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">How I work</p>
          <h2 id="plan-title" className={styles.sectionTitle}>
            What the first 90 days look like.
          </h2>
        </header>
        <ol className={styles.plan}>
          {PLAN.map((phase) => (
            <li key={phase.when} className={styles.phase}>
              <p className={`num ${styles.phaseWhen}`}>{phase.when}</p>
              <h3 className={styles.phaseTitle}>{phase.title}</h3>
              <p className={styles.whatFix}>{phase.does}</p>
              <p className={styles.phaseGet}>
                <span className={styles.stepKind}>You get</span> {phase.get}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`page ${styles.section}`} id="diagnose" aria-labelledby="diagnose-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">For your company</p>
          <h2 id="diagnose-title" className={styles.sectionTitle}>
            What this could be worth at your company.
          </h2>
          <p className={styles.sectionLede}>
            The day-30 estimate, for a typical team. Change the numbers to yours.
          </p>
        </header>
        <Diagnose />
      </section>

      <section className={`page ${styles.section}`} id="skills" aria-labelledby="skills-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Skills</p>
          <h2 id="skills-title" className={styles.sectionTitle}>
            What I work with, and where to see it.
          </h2>
        </header>
        <section
          className={styles.skillsWrap}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs a tab stop so its overflow can be scrolled by keyboard
          tabIndex={0}
          aria-label="Skills and where to see them"
        >
          <table className={styles.skills}>
            <thead>
              <tr>
                <th scope="col">Skill and tools</th>
                <th scope="col">What it does</th>
                <th scope="col">See it here</th>
              </tr>
            </thead>
            <tbody>
              {SKILLS.map((skill) => (
                <tr key={skill.id}>
                  <th scope="row">
                    <span className={styles.skillName}>{skill.name}</span>
                    <span className={styles.skillTools}>{skill.tools.join(" · ")}</span>
                  </th>
                  <td>{skill.plain}</td>
                  <td>
                    <ul className={styles.skillLinks}>
                      {skill.see.map((link) => (
                        <li key={link.href}>
                          {link.href.startsWith("/") ? (
                            <Link href={link.href}>{link.label}</Link>
                          ) : (
                            <a href={link.href}>{link.label}</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>

      <section
        className={`page ${styles.section}`}
        id="simulator"
        aria-labelledby="simulator-title"
      >
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Simulator · for a closer look</p>
          <h2 id="simulator-title" className={styles.sectionTitle}>
            Switch each automation on or off and see what it changes.
          </h2>
          <p className={styles.sectionLede}>
            A made-up company and 90 days of leads. Flip a switch and see what changes; the yellow
            box suggests the next one.
          </p>
        </header>
        <Simulator />
      </section>

      <section
        className={`page ${styles.section}`}
        id="playbooks"
        aria-labelledby="playbooks-title"
      >
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Playbooks</p>
          <h2 id="playbooks-title" className={styles.sectionTitle}>
            Six automations I build.
          </h2>
        </header>
        <ul className={styles.playbooks}>
          {PLAYBOOKS.map((playbook) => (
            <li key={playbook.id} className={styles.playbook} id={playbook.id}>
              <h3 className={styles.playbookName}>{playbook.name}</h3>
              <p className={styles.problem}>{playbook.problem}</p>
              <details className={styles.how}>
                <summary>How it works</summary>
                <ol className={styles.steps}>
                  <li className={styles.trigger}>
                    <span className={styles.stepKind}>When</span> {playbook.trigger}
                  </li>
                  {playbook.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className={styles.guardrail}>
                  <span className={styles.stepKind}>Guardrail</span> {playbook.guardrail}
                </p>
              </details>
              <dl className={styles.playbookMeta}>
                <div>
                  <dt>Judged by</dt>
                  <dd>{playbook.metric}</dd>
                </div>
                {playbook.simulator ? (
                  <div>
                    <dt>In the simulator</dt>
                    <dd>{AUTOMATIONS[playbook.simulator].name}</dd>
                  </div>
                ) : null}
              </dl>
              <ul className={styles.tools} aria-label="Tools">
                {playbook.tools.map((tool) => (
                  <li key={tool} className="tag">
                    {tool}
                  </li>
                ))}
              </ul>
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
