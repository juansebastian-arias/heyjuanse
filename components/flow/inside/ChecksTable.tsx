import type { Check } from "@/core/flow/validate";
import styles from "../Inside.module.css";
import { Scroll } from "./Scroll";

function value(check: Check, number: number): string {
  return check.unit === "%" ? `${number.toFixed(1)}%` : `${number.toFixed(2)} min`;
}

/**
 * The engine's answers next to the formulas', one row per comparison. On a narrow screen the two
 * descriptive columns fold into the row's name, so the numbers stay on screen without scrolling.
 */
export function ChecksTable({ checks }: { checks: readonly Check[] }) {
  return (
    <>
      <Scroll label="Engine against formulas">
        <table className={`${styles.table} ${styles.checks}`}>
          <thead>
            <tr>
              <th scope="col">Queue</th>
              <th scope="col" className={styles.wide}>
                Compared
              </th>
              <th scope="col" className={styles.wide}>
                Formula
              </th>
              <th scope="col" className={styles.number}>
                Formula says
              </th>
              <th scope="col" className={styles.number}>
                Engine measured
              </th>
              <th scope="col">Agree</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={`${check.case.id}-${check.measure}`}>
                <th scope="row">
                  {check.case.notation}
                  <span className={styles.narrow}>
                    {check.what}, by {check.formula}
                  </span>
                  <span className={styles.before}>{check.case.about}</span>
                </th>
                <td className={styles.wide}>{check.what}</td>
                <td className={styles.wide}>{check.formula}</td>
                <td className={styles.number}>{value(check, check.expected)}</td>
                <td className={styles.number}>
                  {value(check, check.simulated)}
                  <span className={styles.before}>± {value(check, check.margin)}</span>
                </td>
                <td data-pass={check.pass}>{check.pass ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
      <p className={styles.note}>
        “±” is the 99% confidence interval of the measurement. A check agrees when the formula's
        value is inside it, or within 2% of it.
      </p>
    </>
  );
}
