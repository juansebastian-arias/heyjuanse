import Link from "next/link";
import { ContactLinks } from "@/components/ContactLinks";
import { AgentDemo } from "@/components/gtm/AgentDemo";
import { HeroEngine } from "@/components/gtm/HeroEngine";
import { ProjectDemo } from "@/components/gtm/ProjectDemo";
import { Simulator } from "@/components/gtm/Simulator";
import { PLAYBOOKS } from "@/content/playbooks";
import { SKILLS } from "@/content/skills";
import { ALL_OFF, AUTOMATIONS } from "@/core/gtm/model";
import { simulate } from "@/core/gtm/simulate";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

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
            Lead routing and scoring, CRM automation and AI agents that draft while a person
            approves.
          </p>
          <ul className={styles.specialties} aria-label="Skills">
            {SITE.specialties.map((specialty) => (
              <li key={specialty}>{specialty}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            <a href="#project" className="button" data-variant="primary">
              See it at your company
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

      <section className={`page ${styles.section}`} id="project" aria-labelledby="project-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Demo · a 90-day project</p>
          <h2 id="project-title" className={styles.sectionTitle}>
            What I would build at your company, and what it is worth.
          </h2>
          <p className={styles.sectionLede}>
            It opens with a typical sales team. Put in your numbers to see your own plan.
          </p>
        </header>
        <ProjectDemo />
      </section>

      <section className={`page ${styles.section}`} id="agent" aria-labelledby="agent-title">
        <header className={styles.sectionHeader}>
          <p className="eyebrow">Demo · AI lead agent</p>
          <h2 id="agent-title" className={styles.sectionTitle}>
            A new lead, answered in seconds. A person approves.
          </h2>
          <p className={styles.sectionLede}>
            One piece of that project, working. Pick a message: the agent decides who should answer
            and drafts the reply. Made-up leads, real recorded runs.
          </p>
        </header>
        <AgentDemo worth={{ manualWaitHours: manualInbound.medianHoursToTouch }} />
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
