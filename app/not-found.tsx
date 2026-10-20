import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className={`page ${styles.page}`}>
      <p className="eyebrow">404</p>
      <h1 className={styles.title}>This page does not exist</h1>
      <p className={styles.text}>
        The address may be mistyped, or the page may have moved. These are the places to start:
      </p>
      <ul className={styles.links}>
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/lab">Decision Lab</Link>
        </li>
        <li>
          <Link href="/architecture">Under the hood</Link>
        </li>
        <li>
          <Link href="/work">Selected work</Link>
        </li>
      </ul>
    </div>
  );
}
