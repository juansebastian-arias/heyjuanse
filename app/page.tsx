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
    what: "Owned the automation and decision layer of an AI-assisted lead program: enrichment, scoring, retrieval of context, AI-drafted messages with human approval, and the A/B audit.",
    result:
      "≈60% higher contract value in the contacted cohort than in the control group, in an A/B test. A result of the whole program, not of my work alone.",
  },
  {
    where: "BairesDev · Office of the CEO",
    what: "Replaced a spreadsheet process with an AI-assisted app that classifies messages, routes opportunities and maps relationships for the executive office.",
  },
  {
    where: "Co-founder and CTO, part-time",
    what: "CRM, automation and AI systems for clients: a healthcare CRM and operations system that runs in production, and lead and workflow automation for real estate.",
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
    problem: "New leads wait days for a first answer.",
    fix: "I route every new lead to the right salesperson in minutes and have AI draft the reply. A person approves before anything is sent.",
    impact: `First answer in ${formatHours(automatedInbound.medianHoursToTouch)} instead of ${formatHours(manualInbound.medianHoursToTouch)}: ${formatSigned(agentValue.meetings)} sales meetings a quarter, about ${formatMoney(agentValue.revenue)} a year.`,
    see: { label: "Watch the AI agent answer a lead", href: "#agent" },
    skills: ["Lead routing", "AI agents", "HubSpot", "n8n"],
  },
  {
    problem: "Nobody knows which tools and automations actually pay off.",
    fix: "I put a dollar value on each change before it is built, then prove it with a control group after launch.",
    impact: `In the example, the ${inboundValue.steps.length} changes that help are worth ${formatMoney(inboundValue.total.revenuePerYear)} a year together, and each one is priced on its own.`,
    see: { label: "See the value of each change", href: "#diagnose" },
    skills: ["Python", "SQL", "A/B tests", "Simulation"],
  },
  {
    problem: "Salespeople lose hours to duplicates and missing data.",
    fix: "I clean and complete the CRM automatically every night and rank leads, so reps start with the ones most likely to buy.",
    impact: `Duplicates alone waste ${Math.round(manualInbound.wastedHours)} rep hours a quarter in the example; the cleanup gives them back.`,
    see: { label: "See how the cleanup works", href: "#hygiene" },
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
            I build the automated engine that turns leads into sales meetings.
          </h1>
          <p className={styles.subclaim}>
            In plain words: every potential customer gets a fast, relevant answer from the right
            salesperson. I build it with automation and AI, and I show what each change is worth in
            dollars.
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
          <p className="eyebrow">What I do, in plain words</p>
          <h2 id="what-title" className={styles.sectionTitle}>
            Three problems most sales teams have, and what fixing them is worth.
          </h2>
          <p className={styles.sectionLede}>
            Figures come from the simulator on this page, with made-up data for a team of three
            salespeople, and assume 1 in 4 sales opportunities closes.
          </p>
        </header>
        <ol className={styles.what}>
          {WHAT.map((item) => (
            <li key={item.problem} className={styles.whatItem}>
              <p className={styles.whatProblem}>{item.problem}</p>
              <p className={styles.whatFix}>{item.fix}</p>
              <p className={styles.whatImpact}>{item.impact}</p>
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
        <p className={styles.whatReal}>
          Done for real, not only simulated: at BairesDev I owned the automation and decision layer
          of an AI-assisted lead program. In its A/B test the contacted group brought ≈60% higher
          contract value than the control group, a result of the whole program, not my work alone.
        </p>
      </section>

      <section className={`page ${styles.section}`} id="agent" aria-labelledby="agent-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">See it working · AI agent</p>
          <h2 id="agent-title" className={styles.sectionTitle}>
            A new lead, answered in seconds. A person approves.
          </h2>
          <p className={styles.sectionLede}>
            Pick a message from the inbox. The agent works out what the person wants, how good a
            customer they could be and which salesperson should answer, then drafts the reply and
            the note for the customer database. These are real runs, recorded. Answering every new
            lead this way adds, in the simulator,{" "}
            <strong className="num">{formatSigned(agentValue.meetings)}</strong> meetings a quarter,
            about <strong className="num">{formatMoney(agentValue.revenue)}</strong> in sales a
            year.
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
            Already calculated for a typical team of two salespeople. Change the numbers to yours
            and it recalculates: which change to make first, and what each one is worth a year.
          </p>
        </header>
        <Diagnose />
      </section>

      <section className={`page ${styles.section}`} id="skills" aria-labelledby="skills-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Technical skills, with proof</p>
          <h2 id="skills-title" className={styles.sectionTitle}>
            Each skill, what it means, and where to see it.
          </h2>
        </header>
        <section
          className={styles.skillsWrap}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs a tab stop so its overflow can be scrolled by keyboard
          tabIndex={0}
          aria-label="Skills with proof"
        >
          <table className={styles.skills}>
            <thead>
              <tr>
                <th scope="col">Skill and tools</th>
                <th scope="col">In plain words</th>
                <th scope="col">See it here</th>
                <th scope="col">Used for real</th>
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
                  <td>{skill.real}</td>
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
          <p className="eyebrow">The full simulator · for a closer look</p>
          <h2 id="simulator-title" className={styles.sectionTitle}>
            Switch each automation on or off and see what it changes.
          </h2>
          <p className={styles.sectionLede}>
            A made-up software company with three salespeople and 90 days of potential customers,
            played out one by one. The same customers come in on every run, so any change you see
            comes from the switch you flipped. The yellow box always says which switch to try next.
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
          <p className="eyebrow">How I build it · playbooks</p>
          <h2 id="playbooks-title" className={styles.sectionTitle}>
            Six automations I build, step by step, and how each one is judged.
          </h2>
        </header>
        <ul className={styles.playbooks}>
          {PLAYBOOKS.map((playbook) => (
            <li key={playbook.id} className={styles.playbook} id={playbook.id}>
              <h3 className={styles.playbookName}>{playbook.name}</h3>
              <p className={styles.problem}>{playbook.problem}</p>
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
          <p className="eyebrow">Real work, not simulated</p>
          <h2 id="proof-title" className={styles.sectionTitle}>
            Where I have built this for real.
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
          <p className={styles.contactText}>
            Happy to walk your team through any of this, or to look at your numbers together.
          </p>
        </div>
        <ContactLinks />
      </section>
    </>
  );
}
