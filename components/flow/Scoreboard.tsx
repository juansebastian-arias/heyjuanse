import { type Difference, type Estimate, isClear, type Projection } from "@/core/flow/experiment";
import { count, days, duration, money, signedCount, signedMoney } from "@/lib/flow/format";
import type { Outcome } from "@/lib/flow/view";
import { costText } from "@/lib/flow/words";
import styles from "./Scoreboard.module.css";

interface ScoreboardProps {
  today: Projection | null;
  outcome: Outcome | null;
  changed: boolean;
  /** The numbers on screen belong to the previous setup; new ones are being simulated. */
  busy: boolean;
}

interface FigureProps {
  label: string;
  now: Estimate;
  was: Estimate | null;
  delta: Difference | null;
  /** Whether a higher value is better. */
  upIsGood: boolean;
  format(value: number): string;
  signed(value: number): string;
  note?: string;
}

function Figure({ label, now, was, delta, upIsGood, format, signed, note }: FigureProps) {
  const moved = delta !== null && was !== null && isClear(delta);
  const tone = !moved ? "flat" : delta.mean > 0 === upIsGood ? "good" : "bad";
  return (
    <div className={styles.figure}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.body}>
        <span className={styles.value}>{format(now.mean)}</span>
        {delta !== null && was !== null ? (
          <span className={styles.delta} data-tone={tone}>
            {moved ? signed(delta.mean) : "no clear change"}
            <span className={styles.was}> · was {format(was.mean)}</span>
          </span>
        ) : null}
        <span className={styles.range}>
          {format(now.low)} to {format(now.high)} in 8 of 10 quarters
          {note ? ` · ${note}` : ""}
        </span>
      </dd>
    </div>
  );
}

const signedDuration = (hours: number) => `${hours > 0 ? "+" : "−"}${duration(Math.abs(hours))}`;
const signedDays = (value: number) => `${value > 0 ? "+" : "−"}${days(Math.abs(value))}`;

/** What the company's month adds up to under the current setup, next to how it runs today. */
export function Scoreboard({ today, outcome, changed, busy }: ScoreboardProps) {
  if (!outcome) {
    return (
      <p className={styles.waiting} aria-live="polite">
        Simulating 60 quarters of Larkspur…
      </p>
    );
  }
  const { now, delta, cost } = outcome;
  const was = changed ? today : null;
  const d = (key: keyof Outcome["delta"]) => (changed && was ? delta[key] : null);
  return (
    <section
      className={styles.board}
      aria-label="What a month adds up to"
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
    >
      <dl className={styles.figures}>
        <Figure
          label="Sales collected a month"
          now={now.totals.cash}
          was={was?.totals.cash ?? null}
          delta={d("cash")}
          upIsGood
          format={money}
          signed={signedMoney}
        />
        <Figure
          label="Buyers lost to waiting, a month"
          now={now.totals.lostBuyers}
          was={was?.totals.lostBuyers ?? null}
          delta={d("lostBuyers")}
          upIsGood={false}
          format={count}
          signed={signedCount}
          note={`worth ${money(now.totals.lostValue.mean)}`}
        />
        <Figure
          label="Average wait before a first reply"
          now={now.totals.replyWaitHours}
          was={was?.totals.replyWaitHours ?? null}
          delta={d("replyWaitHours")}
          upIsGood={false}
          format={duration}
          signed={signedDuration}
        />
        <Figure
          label="Typical time from request to cash"
          now={now.totals.cashDays}
          was={was?.totals.cashDays ?? null}
          delta={d("cashDays")}
          upIsGood={false}
          format={days}
          signed={signedDays}
        />
      </dl>
      {changed ? (
        <p className={styles.after}>
          These changes cost {costText(cost.monthly, cost.setup)}. After that, and after the cost of
          serving the extra customers, Larkspur keeps about{" "}
          <strong>{signedMoney(delta.net.mean)} more a month</strong>.
        </p>
      ) : null}
    </section>
  );
}
