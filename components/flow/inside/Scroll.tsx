import type { ReactNode } from "react";
import styles from "../Inside.module.css";

/**
 * A box for a table that can be wider than the screen: the table scrolls sideways inside it, and
 * the page never does. It can be reached with the keyboard so that it can be scrolled with it.
 */
export function Scroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling box must be focusable for keyboard users to scroll it
    <section className={styles.scroll} tabIndex={0} aria-label={label}>
      {children}
    </section>
  );
}
