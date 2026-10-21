import type { Metadata } from "next";
import Link from "next/link";
import { EDUCATION, WORK } from "@/content/work";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Selected work",
  description:
    "GTM systems, analytics and AI automation at BairesDev, CRM and automation implementation at Sintropia, and earlier work in business analysis, customer success and logistics.",
};

export default function WorkPage() {
  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">Professional experience</p>
        <h1 className={styles.title}>Selected work</h1>
        <p className={styles.lede}>
          Short, factual descriptions of my professional work. The systems involved belong to my
          employer and clients and are confidential, so there are no screenshots, internal data or
          client names here, and the only figures are program-level results cleared for publication.
          The <Link href="/lab">Decision Lab</Link> is separate: an independent demonstration built
          on synthetic data.
        </p>
      </header>

      <ol className={styles.entries}>
        {WORK.map((entry) => (
          <li key={entry.id} className={styles.entry} id={entry.id}>
            <div className={styles.meta}>
              <h2 className={styles.organization}>
                {entry.organization}
                {entry.engagement ? (
                  <span className={styles.engagement}>{entry.engagement}</span>
                ) : null}
              </h2>
              <ul className={styles.roles}>
                {entry.roles.map((role) => (
                  <li key={role.title}>
                    <p className={styles.role}>{role.title}</p>
                    <p className={styles.period}>{role.period}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.body}>
              <p className={styles.summary}>{entry.summary}</p>
              {entry.items.length > 0 ? (
                <ul className={styles.items}>
                  {entry.items.map((item) => (
                    <li key={item.title}>
                      <h3 className={styles.itemTitle}>{item.title}</h3>
                      <p className={styles.itemText}>{item.text}</p>
                      {item.programResult ? (
                        <p className={styles.result}>
                          <span className={styles.resultLabel}>Program-level result</span>{" "}
                          {item.programResult}
                        </p>
                      ) : null}
                      {item.tools ? (
                        <ul className={styles.tools} aria-label="Tools and methods">
                          {item.tools.map((tool) => (
                            <li key={tool}>{tool}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {entry.note ? <p className={styles.note}>{entry.note}</p> : null}
            </div>
          </li>
        ))}
        <li className={styles.entry} id="education">
          <div className={styles.meta}>
            <h2 className={styles.organization}>Education</h2>
          </div>
          <div className={styles.body}>
            <p className={styles.summary}>
              {EDUCATION.degree}, {EDUCATION.school}, {EDUCATION.country}.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
