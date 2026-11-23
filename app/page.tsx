import Link from "next/link";
import { ContactLinks } from "@/components/ContactLinks";
import { AgentDemo } from "@/components/gtm/AgentDemo";
import { Diagnose } from "@/components/gtm/Diagnose";
import { formatMoney, formatSigned } from "@/components/gtm/format";
import { HeroEngine } from "@/components/gtm/HeroEngine";
import { Simulator } from "@/components/gtm/Simulator";
import { PLAYBOOKS } from "@/content/playbooks";
import { plan, valuePlan } from "@/core/gtm/decide";
import { ALL_OFF, AUTOMATIONS } from "@/core/gtm/model";
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
            Routing, enrichment, scoring and AI agents that draft while a person approves. Each one
            switched on because the data says it pays.
          </p>
          <ul className={styles.specialties} aria-label="Skills">
            {SITE.specialties.map((specialty) => (
              <li key={specialty}>{specialty}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <a href="#simulator" className="button" data-variant="primary">
              Try the GTM simulator
            </a>
            <a href="#playbooks" className="button">
              See the playbooks
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

      <section
        className={`page ${styles.section}`}
        id="simulator"
        aria-labelledby="simulator-title"
      >
        <header className={styles.sectionHeader}>
          <p className="eyebrow">GTM simulator · synthetic data</p>
          <h2 id="simulator-title" className={styles.sectionTitle}>
            Pick a strategy, switch on automations, and let the data choose the next move.
          </h2>
          <p className={styles.sectionLede}>
            A fictional software company with three sales reps and 90 days of leads, simulated lead
            by lead. Every run replays the same leads, so any change you see comes from the switch
            you flipped. Start from &ldquo;all manual&rdquo; and follow the recommendation.
          </p>
        </header>
        <Simulator />
      </section>

      <section className={`page ${styles.section}`} id="diagnose" aria-labelledby="diagnose-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Diagnose your funnel</p>
          <h2 id="diagnose-title" className={styles.sectionTitle}>
            Put in your own numbers and get the order to automate in.
          </h2>
        </header>
        <Diagnose />
      </section>

      <section className={`page ${styles.section}`} id="agent" aria-labelledby="agent-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">AI agent · real runs</p>
          <h2 id="agent-title" className={styles.sectionTitle}>
            A new lead, answered in seconds. A person approves.
          </h2>
          <p className={styles.sectionLede}>
            Pick a lead from the inbox. The agent works out what they want, scores the fit, routes
            it to the right rep and drafts the reply and the CRM note. In the simulator, answering
            every inbound lead this way adds{" "}
            <strong className="num">{formatSigned(agentValue.meetings)}</strong> meetings a quarter,
            about <strong className="num">{formatMoney(agentValue.revenue)}</strong> in sales a
            year.
          </p>
        </header>
        <AgentDemo worth={{ manualWaitHours: manualInbound.medianHoursToTouch }} />
      </section>

      <section
        className={`page ${styles.section}`}
        id="playbooks"
        aria-labelledby="playbooks-title"
      >
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Automation playbooks</p>
          <h2 id="playbooks-title" className={styles.sectionTitle}>
            The flows I design and build, and how each one is judged.
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
            Questions about the simulator, the playbooks or my work are welcome.
          </p>
        </div>
        <ContactLinks />
      </section>
    </>
  );
}
