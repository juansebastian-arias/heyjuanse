import styles from "./WeeklyChart.module.css";

/** Meetings per week: the manual baseline next to the current setup, one pair of bars a week. */
export function WeeklyChart({ current, manual }: { current: number[]; manual: number[] }) {
  const max = Math.max(1, ...current, ...manual);
  const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const label = `Meetings per week over 13 weeks. Manual: ${manual.join(", ")}. This setup: ${current.join(", ")}.`;
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span>Meetings booked per week</span>
        <span className={styles.legend}>
          <span className={styles.key} data-series="manual" aria-hidden="true" /> All manual{" "}
          <span className="num">({total(manual)})</span>
          <span className={styles.key} data-series="current" aria-hidden="true" /> This setup{" "}
          <span className="num">({total(current)})</span>
        </span>
      </figcaption>
      <div className={styles.chart} role="img" aria-label={label}>
        {current.map((value, week) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: weeks are positional
            key={week}
            className={styles.week}
            title={`Week ${week + 1}: ${manual[week] ?? 0} manual, ${value} with this setup`}
          >
            <span
              className={styles.bar}
              data-series="manual"
              style={{ height: `${((manual[week] ?? 0) / max) * 100}%` }}
            />
            <span
              className={styles.bar}
              data-series="current"
              style={{ height: `${(value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>Week 1</span>
        <span>Week 13</span>
      </div>
    </figure>
  );
}
