import type { Metadata } from "next";
import Link from "next/link";
import { ContactLinks } from "@/components/ContactLinks";
import { SITE } from "@/site.config";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.name}: GTM systems, analytics and AI automation. Background, and how to get in touch.`,
};

export default function AboutPage() {
  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">About</p>
        <h1 className={styles.title}>{SITE.name}</h1>
      </header>

      <div className={`prose ${styles.prose}`}>
        <p>
          I work where revenue operations, data and software meet. I start from the business
          decision a team has to make, then build the data, rules, automation and AI around it, and
          measure whether it helped.
        </p>
        <p>
          I trained as an industrial engineer at Pontificia Universidad Javeriana in Colombia and
          started in logistics operations, first at Amazon and then at Flexport, where I became a
          team lead. At Bees2Biz I moved into business analysis and customer success: modeling
          processes, turning requirements into software workflows, and implementing and integrating
          CRMs.
        </p>
        <p>
          Since January 2024 I have worked in the Office of the CEO at BairesDev, across sales
          operations, GTM systems, analytics and internal AI automation. Since October 2025 I have
          also been co-founder and part-time CTO of Sintropia, a small company that implements CRM,
          automation and AI-enabled workflows for its clients. More in{" "}
          <Link href="/work">selected work</Link>.
        </p>
        <p>
          This site is itself a piece of work: the <Link href="/lab">Decision Lab</Link> is a
          working system, and <Link href="/architecture">under the hood</Link> explains how it is
          built and why. The <Link href="/colophon">colophon</Link> says how it was made.
        </p>
      </div>

      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <h2 id="contact-title" className={styles.contactTitle}>
          Get in touch
        </h2>
        <p className={styles.contactText}>
          Questions about the lab, the code or my work are welcome.
        </p>
        <ContactLinks />
      </section>
    </div>
  );
}
