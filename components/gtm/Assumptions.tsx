import { AUTOMATION_IDS, AUTOMATIONS, MOTION_IDS, MOTIONS, TEAM } from "@/core/gtm/model";
import { formatHours, formatMoney } from "./format";
import styles from "./Simulator.module.css";

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function Assumptions() {
  return (
    <details className={styles.assumptions} id="assumptions">
      <summary>Every assumption behind these numbers</summary>
      <div className={styles.assumptionsBody}>
        <p>
          A fictional B2B software company. Leads are generated once per strategy from a fixed seed,
          and every run replays the same leads, so a difference between two runs comes only from the
          switch you changed. These are planning assumptions, not forecasts, and none of them comes
          from an employer or client.
        </p>
        <p>
          Team: {TEAM.reps} reps with {TEAM.sellingHoursPerDay} hours a day for first touches, at{" "}
          {formatMoney(TEAM.costPerRepHour)} an hour. A first-touch sequence takes{" "}
          {TEAM.manualMinutes} minutes by hand or {TEAM.aiMinutes} minutes reviewing an AI draft (+
          {TEAM.lookupMinutes} without company data). Leads go cold after {TEAM.staleAfterDays}{" "}
          days. AI-researched messages book {pct(TEAM.aiLift - 1)} more often.
        </p>
        <section
          className={styles.tableWrap}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs a tab stop so its overflow can be scrolled by keyboard
          tabIndex={0}
          aria-label="Assumptions by strategy"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Strategy</th>
                <th scope="col" className={styles.right}>
                  Leads
                </th>
                <th scope="col" className={styles.right}>
                  Cost per lead
                </th>
                <th scope="col" className={styles.right}>
                  Duplicates
                </th>
                <th scope="col" className={styles.right}>
                  Missing data
                </th>
                <th scope="col" className={styles.right}>
                  Manual routing
                </th>
                <th scope="col" className={styles.right}>
                  Deal size
                </th>
              </tr>
            </thead>
            <tbody>
              {MOTION_IDS.map((id) => {
                const m = MOTIONS[id];
                return (
                  <tr key={id}>
                    <th scope="row">{m.name}</th>
                    <td className={`num ${styles.right}`}>{m.leads.toLocaleString("en-US")}</td>
                    <td className={`num ${styles.right}`}>{formatMoney(m.costPerLead)}</td>
                    <td className={`num ${styles.right}`}>{pct(m.duplicateRate)}</td>
                    <td className={`num ${styles.right}`}>{pct(m.missingDataRate)}</td>
                    <td className={`num ${styles.right}`}>{formatHours(m.manualRoutingHours)}</td>
                    <td className={`num ${styles.right}`}>{formatMoney(m.dealSize)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <ul className={styles.costList}>
          {AUTOMATION_IDS.map((id) => (
            <li key={id}>
              <strong>{AUTOMATIONS[id].name}</strong>: {AUTOMATIONS[id].effect}{" "}
              <span className="num">({formatMoney(AUTOMATIONS[id].monthlyCost)}/month)</span>
            </li>
          ))}
        </ul>
        <p>
          The model and its tests are in the{" "}
          <a href="https://github.com/juansebastian-arias/heyjuanse/tree/main/core/gtm">
            source code
          </a>
          .
        </p>
      </div>
    </details>
  );
}
