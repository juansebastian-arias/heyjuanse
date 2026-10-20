import { LANE_LABELS } from "@/core/routing/route";
import type { LobbySnapshot } from "@/lib/server/lobby";
import styles from "./LobbyMarks.module.css";

/** The default week, as the rules engine routed it when the site was built. */
export function LobbyMarks({ snapshot }: { snapshot: LobbySnapshot }) {
  const lanes = snapshot.lanes.filter((lane) => lane.marks.length > 0);
  const summary = [
    `${snapshot.weekLabel}: ${snapshot.leads} leads after cleaning.`,
    ...lanes.map((lane) =>
      lane.lane === "sales"
        ? `${LANE_LABELS.sales}: ${lane.marks.length}, of which ${snapshot.called} get a call.`
        : `${LANE_LABELS[lane.lane]}: ${lane.marks.length}.`,
    ),
    `${snapshot.needs} people had a real need; ${snapshot.calledWithNeed} of them got a call.`,
  ].join(" ");

  return (
    <figure className={styles.figure}>
      <div className={styles.field} role="img" aria-label={summary}>
        {lanes.map((lane) => (
          <div key={lane.lane} className={styles.lane} data-lane={lane.lane} aria-hidden="true">
            <p className={styles.label}>
              <span className={styles.name}>{LANE_LABELS[lane.lane]}</span>
              <span className="num">{lane.marks.length}</span>
            </p>
            <div className={styles.marks}>
              {lane.marks.map((mark, index) => (
                <span
                  // Marks are positional; the order is the lane's queue or score order.
                  // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                  key={index}
                  className={styles.mark}
                  data-need={mark.need || undefined}
                  data-waiting={mark.waiting || undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <figcaption className={styles.caption}>
        Real output, not an illustration: {snapshot.weekLabel}’s {snapshot.submissions} synthetic
        form submissions became {snapshot.leads} leads, routed by the Decision Lab’s default rules.
        Filled squares had a real need; faded ones qualified but wait, because sales can only make{" "}
        {snapshot.capacity} calls.
      </figcaption>
    </figure>
  );
}
