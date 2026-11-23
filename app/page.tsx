import Link from "next/link";
import { ContactLinks } from "@/components/ContactLinks";
import { AgentDemo } from "@/components/gtm/AgentDemo";
import { Diagnose } from "@/components/gtm/Diagnose";
import { formatHours, formatMoney, formatSigned } from "@/components/gtm/format";
import { HeroEngine } from "@/components/gtm/HeroEngine";
import { Simulator } from "@/components/gtm/Simulator";
import { PLAYBOOKS } from "@/content/playbooks";
import { SKILLS } from "@/content/skills";
import { plan, valuePlan } from "@/core/gtm/decide";
import { ALL_OFF, ALL_ON, AUTOMATIONS } from "@/core/gtm/model";
import { simulate } from "@/core/gtm/simulate";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

const PROOF = [
  {
    where: "BairesDev · Office of the CEO",
    what: "I run the automation and decision layer of an AI-assisted lead program.",
    result: "≈60% higher contract value than the control group in its A/B test. A program result.",
  },
  {
    where: "BairesDev · Office of the CEO",
    what: "An AI-assisted app that classifies messages and routes opportunities for the executive office.",
  },
  {
    where: "Sintropia · Co-founder and CTO",
    what: "CRM, automation and AI systems for clients, including a healthcare CRM in production.",
  },
];

const manualInbound = simulate("inbound", ALL_OFF);
const inboundValue = valuePlan(plan("inbound", ALL_OFF));
// The agent does two of the simulator's improvements: instant routing and AI drafts.
const agentSteps = inboundValue.steps.filter(
  (step) => step.automation === "instantRouting" || step.automation === "aiDrafts",
);
const agentValue = {
  meetings: agentSteps.reduce((sum, step) => sum + step.meetingsPerQuarter, 0),
  revenue: agentSteps.reduce((sum, step) => sum + step.revenuePerYear, 0),
};
const automatedInbound = simulate("inbound", ALL_ON);

/** The problems a sales team brings, in their words, each with the fix, its value and a demo. */
const WHAT = [
  {
    problem: "Leads wait days for an answer.",
    fix: "Instant routing and AI-drafted replies. A person approves.",
    impact: `${formatHours(automatedInbound.medianHoursToTouch)} instead of ${formatHours(manualInbound.medianHoursToTouch)} · ${formatMoney(agentValue.revenue)} a year`,
    see: { label: "Watch the agent", href: "#agent" },
    skills: ["Lead routing", "AI agents", "HubSpot", "n8n"],
  },
  {
    problem: "Nobody knows which tools pay off.",
    fix: "Every change priced in dollars before it is built, and proven after.",
    impact: `${inboundValue.steps.length} changes · ${formatMoney(inboundValue.total.revenuePerYear)} a year`,
    see: { label: "Price it for your team", href: "#diagnose" },
    skills: ["Python", "SQL", "A/B tests"],
  },
  {
    problem: "Reps lose hours to messy data.",
    fix: "Nightly CRM cleanup and lead ranking.",
    impact: `${Math.round(manualInbound.wastedHours)} rep hours a quarter back`,
    see: { label: "See how", href: "#hygiene" },
    skills: ["HubSpot", "Zoho", "Make", "Zapier"],
  },
] as const;

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
            Automation and AI that answer every lead fast, send it to the right person and show what
            each change is worth.
          </p>
          <ul className={styles.specialties} aria-label="Skills">
            {SITE.specialties.map((specialty) => (
              <li key={specialty}>{specialty}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <a href="#what" className="button" data-variant="primary">
              What I do for a sales team
            </a>
            <a href="#agent" className="button">
              Watch the AI agent
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

      <section className={`page ${styles.section}`} id="what" aria-labelledby="what-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">What I do</p>
          <h2 id="what-title" className={styles.sectionTitle}>
            Three problems I solve for sales teams.
          </h2>
          <p className={styles.sectionLede}>Example figures from the simulator below.</p>
        </header>
        <ol className={styles.what}>
          {WHAT.map((item) => (
            <li key={item.problem} className={styles.whatItem}>
              <p className={styles.whatProblem}>{item.problem}</p>
              <p className={styles.whatFix}>{item.fix}</p>
              <p className={`num ${styles.whatImpact}`}>{item.impact}</p>
              <a href={item.see.href} className={styles.whatLink}>
                {item.see.label} ↓
              </a>
              <ul className={styles.tools} aria-label="Skills used">
                {item.skills.map((skill) => (
                  <li key={skill} className="tag">
                    {skill}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={`page ${styles.section}`} id="agent" aria-labelledby="agent-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">See it working · AI agent</p>
          <h2 id="agent-title" className={styles.sectionTitle}>
            A new lead, answered in seconds. A person approves.
          </h2>
          <p className={styles.sectionLede}>
            Pick a message. In seconds the agent decides who should answer and drafts the reply.
            Real runs, recorded.
          </p>
        </header>
        <AgentDemo worth={{ manualWaitHours: manualInbound.medianHoursToTouch }} />
      </section>

      <section className={`page ${styles.section}`} id="diagnose" aria-labelledby="diagnose-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">For your company</p>
          <h2 id="diagnose-title" className={styles.sectionTitle}>
            What this could be worth at your company.
          </h2>
          <p className={styles.sectionLede}>
            Calculated for a typical team. Change the numbers to yours.
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

      <section className={`page ${styles.section}`} aria-labelledby="proof-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">In production</p>
          <h2 id="proof-title" className={styles.sectionTitle}>
            Where these systems run today.
          </h2>
        </header>
        <ul className={styles.proof}>
          {PROOF.map((item) => (
            <li key={item.what} className={styles.proofItem}>
              <p className="eyebrow">{item.where}</p>
              <p className={styles.proofText}>{item.what}</p>
              {item.result ? <p className={styles.proofResult}>{item.result}</p> : null}
            </li>
          ))}
        </ul>
        <p className={styles.more}>
          <Link href="/work">All my work</Link> ·{" "}
          <Link href="/lab">Case study: the lead-scoring Decision Lab</Link> ·{" "}
          <Link href="/architecture">How it is built</Link>
        </p>
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
