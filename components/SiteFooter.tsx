import Link from "next/link";
import { SITE } from "@/site.config";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.inner}`}>
        <p className={styles.note}>
          The lab uses synthetic data only. Larkspur is a fictional company, and every person,
          company and message in it was generated.
        </p>
        <ul className={styles.links}>
          <li>
            <Link href="/colophon">Colophon</Link>
          </li>
          <li>
            <a href={SITE.repository}>Source code</a>
          </li>
          <li>
            <Link href="/about#contact">Get in touch</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
