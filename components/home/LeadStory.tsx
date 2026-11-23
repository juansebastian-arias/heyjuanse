import { RESPONSE_STUDY } from "@/content/benchmarks";
import styles from "./LeadStory.module.css";

const WITHOUT = [
  { time: "Mon 9:02", text: "Lands in a shared inbox." },
  { time: "Tue", text: "Someone notices it and picks a salesperson." },
  { time: "Wed", text: "The first reply goes out." },
];

const WITH = [
  { time: "9:02", text: "Reaches the right salesperson, with the buyer’s history." },
  { time: "9:02", text: "A reply is already drafted for them." },
  { time: "9:07", text: "The salesperson checks it and sends it." },
];

/**
 * The home page's first visual: one lead handled two ways, so a reader sees the value in a few
 * seconds. The slow side uses the average reply time from a published study.
 */
export function LeadStory() {
  return (
    <figure className={styles.story}>
      <figcaption className={styles.head}>
        <span className="eyebrow">One lead, two ways</span>
        <span className={styles.lead}>A buyer asks for a demo on Monday at 9:02.</span>
      </figcaption>
      <div className={styles.columns}>
        <div className={styles.col} data-kind="without">
          <p className={styles.colTitle}>Without a system</p>
          <p className={styles.total}>
            <span className={styles.totalValue}>{RESPONSE_STUDY.averageReplyHours} hours</span>
            <span className={styles.totalLabel}>to the first reply</span>
          </p>
          <ol className={styles.events}>
            {WITHOUT.map((event) => (
              <li key={event.text}>
                <span className={styles.time}>{event.time}</span>
                <span>{event.text}</span>
              </li>
            ))}
          </ol>
          <p className={styles.outcome}>By then, the buyer is talking to a competitor.</p>
        </div>
        <div className={styles.col} data-kind="with">
          <p className={styles.colTitle}>With a system I build</p>
          <p className={styles.total}>
            <span className={styles.totalValue}>5 minutes</span>
            <span className={styles.totalLabel}>to the first reply</span>
          </p>
          <ol className={styles.events}>
            {WITH.map((event) => (
              <li key={event.text}>
                <span className={styles.time}>{event.time}</span>
                <span>{event.text}</span>
              </li>
            ))}
          </ol>
          <p className={styles.outcome}>A meeting is booked the same morning.</p>
        </div>
      </div>
      <p className={styles.note}>
        {RESPONSE_STUDY.averageReplyHours} hours is the average reply time in a{" "}
        <a href={RESPONSE_STUDY.url} rel="noopener noreferrer">
          {RESPONSE_STUDY.publication} study
        </a>{" "}
        of {RESPONSE_STUDY.companies.toLocaleString("en-US")} US companies.
      </p>
    </figure>
  );
}
