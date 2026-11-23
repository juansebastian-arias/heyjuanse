import Link from "next/link";
import { SITE } from "@/site.config";
import styles from "./SiteHeader.module.css";

/** A name, a way in to how the thing is built, and a way to reach its author. Nothing else. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`page ${styles.inner}`}>
        <Link href="/" className={styles.wordmark}>
          {SITE.name}
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <Link href="/engine" className={styles.link}>
            How it is built
          </Link>
          <a href="#contact" className={styles.link}>
            Get in touch
          </a>
        </nav>
      </div>
    </header>
  );
}
