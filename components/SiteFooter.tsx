import Link from "next/link";
import { SITE } from "@/site.config";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.inner}`}>
        <p className={styles.note}>
          The simulator and the lab use synthetic data only. Their companies are fictional, and
          every person, company, lead and message in them was generated.
        </p>
        <ul className={styles.links}>
          <li>
            <Link href="/architecture">How it is built</Link>
          </li>
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
