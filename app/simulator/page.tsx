import type { Metadata } from "next";
import { HeroEngine } from "@/components/gtm/HeroEngine";
import { Simulator } from "@/components/gtm/Simulator";
import { PLAYBOOKS } from "@/content/playbooks";
import { AUTOMATIONS } from "@/core/gtm/model";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "GTM simulator",
  description:
    "Switch lead automations on and off over 90 days of made-up leads, compare strategies and see which change adds the most sales meetings. Plus six automation playbooks.",
};

export default function SimulatorPage() {
  return (
    <>
      <header className={`page ${styles.header}`}>
        <div className={styles.intro}>
          <p className="eyebrow">Simulator</p>
          <h1 className={styles.title}>Which automation pays most? Try it on 90 days of leads.</h1>
          <p className={styles.lede}>
            A made-up company, its leads and its sales team. Switch each automation on or off,
            compare strategies, and follow the suggestion for the next change.
          </p>
        </div>
        <div className={styles.summary}>
          <HeroEngine />
        </div>
      </header>

      <section className={`page ${styles.section}`} id="simulator" aria-label="Simulator">
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
            Six automations I build, step by step.
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
    </>
  );
}
