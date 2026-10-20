import Link from "next/link";
import { SITE } from "@/site.config";
import { NavLinks } from "./NavLinks";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`page ${styles.inner}`}>
        <Link href="/" className={styles.wordmark}>
          {SITE.name}
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
