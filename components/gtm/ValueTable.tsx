import type { PlanValue } from "@/core/gtm/decide";
import { AUTOMATIONS, TEAM } from "@/core/gtm/model";
import { formatMoney, formatSigned, formatSignedMoney } from "./format";
import styles from "./ValueTable.module.css";

/** What each improvement in a plan is worth in dollars, in the order the data recommends it. */
export function ValueTable({
  value,
  label,
  showTotal = true,
}: {
  value: PlanValue;
  label: string;
  showTotal?: boolean;
}) {
  if (!value.steps.length) return null;
  const pct = Math.round(TEAM.winRate * 100);
  return (
    <div className={styles.wrap}>
      {showTotal ? (
        <p className={styles.total}>
          All together: <strong className="num">{formatMoney(value.total.revenuePerYear)}</strong>{" "}
          more in sales a year,{" "}
          {value.total.costPerYear <= 0 ? (
            <>
              and <span className="num">{formatMoney(-value.total.costPerYear)}</span> a year less
              spent on tools and team time.
            </>
          ) : (
            <>
              for <span className="num">{formatMoney(value.total.costPerYear)}</span> a year in
              tools and team time.
            </>
          )}
        </p>
      ) : null}
      <section
        className={styles.scroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs a tab stop so its overflow can be scrolled by keyboard
        tabIndex={0}
        aria-label={label}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Improvement</th>
              <th scope="col" className={styles.right}>
                Meetings a quarter
              </th>
              <th scope="col" className={styles.right}>
                Sales a year
              </th>
              <th scope="col" className={`${styles.right} ${styles.wide}`}>
                Cost a year
              </th>
              <th scope="col" className={`${styles.right} ${styles.wide}`}>
                Net a year
              </th>
            </tr>
          </thead>
          <tbody>
            {value.steps.map((step) => (
              <tr key={step.automation}>
                <th scope="row">
                  <span className={styles.full}>{AUTOMATIONS[step.automation].name}</span>
                  <span className={styles.short}>{AUTOMATIONS[step.automation].short}</span>
                </th>
                <td className={`num ${styles.right}`}>{formatSigned(step.meetingsPerQuarter)}</td>
                <td className={`num ${styles.right} ${styles.strong}`}>
                  {formatSignedMoney(step.revenuePerYear)}
                </td>
                <td className={`num ${styles.right} ${styles.wide}`}>
                  {formatSignedMoney(step.costPerYear)}
                </td>
                <td className={`num ${styles.right} ${styles.wide}`}>
                  {formatSignedMoney(step.netPerYear)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className={styles.note}>
        Sales a year: extra pipeline times a {pct}% win rate, over four quarters. Cost a year: tools
        plus rep hours; a minus sign means it saves money. Net: sales minus cost. Synthetic data; an
        estimate, not a promise.
      </p>
    </div>
  );
}
