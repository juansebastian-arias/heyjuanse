import type { Metadata } from "next";
import Link from "next/link";
import { EDUCATION, WORK } from "@/content/work";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Selected work",
  description:
    "GTM systems, analytics and AI automation at BairesDev, CRM and automation implementation at Sintropia, and earlier work in business analysis and logistics.",
};

export default function WorkPage() {
  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">Professional experience</p>
        <h1 className={styles.title}>Selected work</h1>
        <p className={styles.lede}>
          Short, factual descriptions of my professional work. The systems involved belong to my
          employer and clients and are confidential, so there are no screenshots, internal numbers
          or client names here. The <Link href="/lab">Decision Lab</Link> is separate: an
          independent demonstration built on synthetic data.
        </p>
      </header>

      <ol className={styles.entries}>
        {WORK.map((entry) => (
          <li key={entry.id} className={styles.entry} id={entry.id}>
            <div className={styles.meta}>
              <h2 className={styles.organization}>{entry.organization}</h2>
              <p className={styles.role}>{entry.role}</p>
              {entry.period ? <p className={styles.period}>{entry.period}</p> : null}
            </div>
            <div className={styles.body}>
              <p className={styles.summary}>{entry.summary}</p>
              {entry.items.length > 0 ? (
                <ul className={styles.items}>
                  {entry.items.map((item) => (
                    <li key={item.title}>
                      <h3 className={styles.itemTitle}>{item.title}</h3>
                      <p className={styles.itemText}>{item.text}</p>
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
