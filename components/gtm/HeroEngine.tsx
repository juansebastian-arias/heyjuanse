import { ALL_OFF, ALL_ON, MOTIONS, TEAM } from "@/core/gtm/model";
import { simulate } from "@/core/gtm/simulate";
import { formatHours, formatMoney } from "./format";
import styles from "./HeroEngine.module.css";

const NODES = ["Capture", "Clean", "Enrich", "Score", "Route", "AI draft", "Meeting"];
// Which dots leave the flow early (duplicates, nurture), and where.
const DOTS = [
  { delay: 0, drop: null },
  { delay: 0.6, drop: "clean" },
  { delay: 1.2, drop: null },
  { delay: 1.8, drop: "score" },
  { delay: 2.4, drop: null },
  { delay: 3.0, drop: "score" },
  { delay: 3.6, drop: null },
  { delay: 4.2, drop: "clean" },
] as const;

/** The home page's first visual: an animated flow and a before-and-after computed at build time. */
export function HeroEngine() {
  const manual = simulate("inbound", ALL_OFF);
  const automated = simulate("inbound", ALL_ON);
  const rows = [
    {
      label: "Meetings booked",
      before: manual.meetings.toLocaleString("en-US"),
      after: automated.meetings.toLocaleString("en-US"),
    },
    {
      label: "Time to first touch",
      before: formatHours(manual.medianHoursToTouch),
      after: formatHours(automated.medianHoursToTouch),
    },
    {
      label: "Cost per meeting",
      before: formatMoney(manual.costPerMeeting),
      after: formatMoney(automated.costPerMeeting),
    },
  ];
  return (
    <figure className={styles.card}>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.line} />
        {NODES.map((node, index) => (
          <span
            key={node}
            className={styles.node}
            data-last={index === NODES.length - 1 || undefined}
            style={{ left: `${(index / (NODES.length - 1)) * 100}%` }}
          >
            <span className={styles.nodeDot} />
            <span className={styles.nodeLabel}>{node}</span>
          </span>
        ))}
        {DOTS.map((dot) => (
          <span
            key={dot.delay}
            className={styles.lead}
            data-drop={dot.drop ?? undefined}
            style={{ animationDelay: `${dot.delay}s` }}
          />
        ))}
      </div>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Same {MOTIONS.inbound.leads.toLocaleString("en-US")} inbound leads, same {TEAM.reps} reps,
          90 days. Simulated.
        </caption>
        <thead>
          <tr>
            <td />
            <th scope="col">By hand</th>
            <th scope="col">Automated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td className="num">{row.before}</td>
              <td className={`num ${styles.after}`}>{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a href="#simulator" className={styles.link}>
        Change the strategy and the automations yourself <span aria-hidden="true">↓</span>
      </a>
    </figure>
  );
}
