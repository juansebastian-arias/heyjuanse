import { peopleAt, STATION_IDS, STATIONS, TODAY } from "@/core/flow/company";
import type { Projection } from "@/core/flow/experiment";
import { assumptionsFor, type Scenario } from "@/core/flow/scenario";
import { count, duration, hoursPerDay, percent } from "@/lib/flow/format";
import styles from "../Inside.module.css";
import { Scroll } from "./Scroll";

interface WhyPanelProps {
  scenario: Scenario;
  today: Projection | null;
  now: Projection | null;
  changed: boolean;
}

interface CellProps {
  now: number;
  was: number | null;
  format(value: number): string;
}

/** A measurement, with today's value under it when the visitor's changes moved it. */
function Cell({ now, was, format }: CellProps) {
  const text = format(now);
  const before = was === null ? null : format(was);
  return (
    <td className={styles.number}>
      {text}
      {before !== null && before !== text ? (
        <span className={styles.before}>{before} today</span>
      ) : null}
    </td>
  );
}

/** The measurements behind the drawing, as a table: the floor's text equivalent. */
export function WhyPanel({ scenario, today, now, changed }: WhyPanelProps) {
  if (!now) return <p className={styles.note}>Simulating…</p>;
  const a = assumptionsFor(scenario.tweaks);
  const was = changed ? today : null;
  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        A line forms wherever work arrives faster than it is picked up. For each team, this is how
        much work arrives, how much time there is for it, and where a waiting request spends its
        time{changed ? ", with your changes and as it is today" : ""}.
      </p>
      <Scroll label="Work and waits by team">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Team
              </th>
              <th scope="col" rowSpan={2} className={styles.number}>
                People × hours a day
              </th>
              <th scope="col" rowSpan={2} className={styles.number}>
                Work arriving a day
              </th>
              <th scope="col" rowSpan={2} className={styles.number}>
                …as a share of the team's hours
              </th>
              <th scope="col" rowSpan={2} className={styles.number}>
                Share of its hours spent working
              </th>
              <th scope="col" rowSpan={2} className={styles.number}>
                Average wait
              </th>
              <th scope="colgroup" colSpan={3} className={styles.span}>
                Of that wait, time spent waiting…
              </th>
              <th scope="col" rowSpan={2} className={styles.number}>
                Buyers lost a month
              </th>
            </tr>
            <tr>
              <th scope="col" className={styles.number}>
                to be assigned
              </th>
              <th scope="col" className={styles.number}>
                for a free person
              </th>
              <th scope="col" className={styles.number}>
                for the office to open
              </th>
            </tr>
          </thead>
          <tbody>
            {STATION_IDS.map((id) => {
              const s = now.stations[id];
              const w = was?.stations[id] ?? null;
              const people = peopleAt(scenario.setup, id, a);
              const peopleToday = peopleAt(TODAY, id, a);
              const share = (p: Projection["stations"][typeof id]) =>
                p.capacityHours.mean > 0 ? p.loadHours.mean / p.capacityHours.mean : 0;
              const notes = [
                s.autoShare.mean >= 0.005 ? `${percent(s.autoShare.mean)} approved by rule` : null,
                s.redoShare.mean >= 0.005 ? `${percent(s.redoShare.mean)} sent back` : null,
              ].filter((note) => note !== null);
              return (
                <tr key={id}>
                  <th scope="row">
                    {STATIONS[id].name}
                    <span className={styles.before}>
                      {[STATIONS[id].team, ...notes].join(" · ")}
                    </span>
                  </th>
                  <td className={styles.number}>
                    {people} × {hoursPerDay(a.hoursPerDay[id])}
                    {people !== peopleToday ? (
                      <span className={styles.before}>{peopleToday} today</span>
                    ) : null}
                  </td>
                  <Cell
                    now={s.loadHours.mean}
                    was={w?.loadHours.mean ?? null}
                    format={hoursPerDay}
                  />
                  <Cell now={share(s)} was={w ? share(w) : null} format={percent} />
                  <Cell now={s.busyShare.mean} was={w?.busyShare.mean ?? null} format={percent} />
                  <Cell
                    now={s.meanWaitHours.mean}
                    was={w?.meanWaitHours.mean ?? null}
                    format={duration}
                  />
                  <Cell
                    now={s.assignHours.mean}
                    was={w?.assignHours.mean ?? null}
                    format={duration}
                  />
                  <Cell now={s.lineHours.mean} was={w?.lineHours.mean ?? null} format={duration} />
                  <Cell
                    now={s.closedHours.mean}
                    was={w?.closedHours.mean ?? null}
                    format={duration}
                  />
                  <Cell now={s.leftBuyers.mean} was={w?.leftBuyers.mean ?? null} format={count} />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={9}>
                All teams
              </th>
              <Cell
                now={now.totals.lostBuyers.mean}
                was={was?.totals.lostBuyers.mean ?? null}
                format={count}
              />
            </tr>
          </tfoot>
        </table>
      </Scroll>
      <ul className={styles.notes}>
        <li>
          The share of the team's hours is the work arriving divided by the hours the team has for
          it. Above 100%, the line can only stop growing when customers give up.
        </li>
        <li>
          Where a team spends less time working than the work arriving would take, the difference is
          work that left before its turn.
        </li>
        <li>
          Waits are averages in calendar time, nights and weekends included, over the {now.runs}{" "}
          simulated quarters.
        </li>
      </ul>
    </div>
  );
}
