"use client";

import { useId, useState } from "react";
import styles from "./Hood.module.css";

/** A toggle that reveals the query behind a number or a table. */
export function ShowSql({ sql, label = "SQL" }: { sql: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={styles.showSql}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? `Hide ${label}` : `Show ${label}`}
      </button>
      {open ? (
        <pre id={id} className={styles.code}>
          <code>{sql}</code>
        </pre>
      ) : null}
    </div>
  );
}
