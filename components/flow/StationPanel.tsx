import {
  extraPeople,
  hasLever,
  LEVER_IDS,
  LEVERS,
  MAX_EXTRA_PEOPLE,
  peopleAt,
  type Setup,
  STATION_IDS,
  STATION_INDEX,
  STATIONS,
  type StationId,
  withExtra,
  withLever,
} from "@/core/flow/company";
import type { Reading } from "@/core/flow/diagnose";
import { type Move, moveKey, type Option } from "@/core/flow/planner";
import { assumptionsFor, type Scenario } from "@/core/flow/scenario";
import { duration, hoursPerDay, percent, plural, signedMoney } from "@/lib/flow/format";
import {
  causeDetail,
  causeHeadline,
  costText,
  KIND_LABEL,
  loadShare,
  lostText,
  moveKind,
  moveMechanism,
  moveName,
  moveWhat,
  peopleText,
  rangeText,
  VERDICT_LABEL,
  verdictText,
} from "@/lib/flow/words";
import styles from "./StationPanel.module.css";

interface StationPanelProps {
  station: StationId;
  onStation(station: StationId): void;
  scenario: Scenario;
  /** Measurements of the setup on screen and of today's company. Either can still be on its way. */
  readings: Reading[] | null;
  todayReadings: Reading[] | null;
  options: Option[] | null;
  /** The team's measurements on screen belong to the previous setup; new ones are on their way. */
  stale: boolean;
  /** The same, for what each open change was measured to do. */
  busy: boolean;
  /** The planner's next move, wherever it is. */
  best: Option | null;
  onApply(option: Option, follow: boolean): void;
  onSetup(setup: Setup): void;
}

/** Where a wait goes. Every hour of it is counted once, under what the request was waiting for. */
const WAIT_PARTS = [
  { key: "assignHours", label: "to be assigned" },
  { key: "lineHours", label: "for a free person" },
  { key: "closedHours", label: "for the office to open" },
] as const;

function WaitBar({ reading, scale }: { reading: Reading; scale: number }) {
  const total = reading.assignHours + reading.lineHours + reading.closedHours;
  const parts = WAIT_PARTS.map((part, index) => ({
    ...part,
    slot: index + 1,
    hours: reading[part.key],
  })).filter((part) => part.hours >= 0.05);
  const summary = parts.map((part) => `${duration(part.hours)} ${part.label}`).join(", ");
  return (
    <div className={styles.wait}>
      <div
        className={styles.bar}
        role="img"
        aria-label={`Average wait ${duration(reading.waitHours)}${summary ? `: ${summary}` : ""}.`}
      >
        <div
          className={styles.fill}
          style={{ width: `${scale > 0 ? Math.min(100, (total / scale) * 100) : 0}%` }}
        >
          {parts.map((part) => (
            <span
              key={part.key}
              data-part={part.slot}
              style={{ flexGrow: part.hours }}
              title={`${duration(part.hours)} ${part.label}`}
            />
          ))}
        </div>
      </div>
      {parts.length > 0 ? (
        <ul className={styles.key}>
          {parts.map((part) => (
            <li key={part.key}>
              <i data-part={part.slot} />
              <span>
                <b>{duration(part.hours)}</b> {part.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const LEVEL_WORD = {
  over: "more than it can do",
  full: "nothing to spare",
  tight: "little to spare",
  fine: "room to spare",
} as const;

function LoadMeter({ reading }: { reading: Reading }) {
  const use = loadShare(reading);
  const level = use >= 1 ? "over" : use >= 0.95 ? "full" : use >= 0.8 ? "tight" : "fine";
  return (
    <div className={styles.load}>
      <p className={styles.fact}>
        {percent(use)} of its hours
        <span className={styles.was}> · {LEVEL_WORD[level]}</span>
      </p>
      <div
        className={styles.meter}
        data-level={level}
        role="img"
        aria-label={`Work arriving takes ${percent(use)} of the team's hours: ${LEVEL_WORD[level]}.`}
      >
        <span style={{ width: `${Math.min(100, use * 100)}%` }} />
      </div>
      <p className={styles.small}>
        {hoursPerDay(reading.loadHours)} of work arrive a day; the team has{" "}
        {hoursPerDay(reading.capacityHours)} for it.
      </p>
    </div>
  );
}

interface RowProps {
  move: Move;
  option: Option | null;
  scenario: Scenario;
  isBest: boolean;
  busy: boolean;
  onApply(option: Option, follow: boolean): void;
}

/** A change that can still be made, with what it was measured to do. */
function OpenRow({ move, option, scenario, isBest, busy, onApply }: RowProps) {
  const a = assumptionsFor(scenario.tweaks);
  const kind = moveKind(move);
  return (
    <li className={styles.option} data-best={isBest || undefined}>
      <div className={styles.main}>
        <p className={styles.tags}>
          <span className="tag" data-kind={kind === "ai" ? "ai" : undefined}>
            {KIND_LABEL[kind]}
          </span>
          {isBest ? (
            <span className="tag" data-kind="key">
              Best next move
            </span>
          ) : null}
        </p>
        <h4 className={styles.name}>{moveName(move)}</h4>
        <p className={styles.what}>{moveWhat(move, a)}</p>
        <details className={styles.more}>
          <summary>What it changes in the model</summary>
          <p>{moveMechanism(move)}</p>
          {move.kind === "lever" ? <p>How it is built: {LEVERS[move.lever].build}</p> : null}
        </details>
      </div>
      <div className={styles.side} data-busy={busy || undefined}>
        {option ? (
          <>
            <p className={styles.gain}>
              <span className={styles.amount}>{signedMoney(option.cash.mean)}</span> a month in
              sales collected
            </p>
            <p className={styles.small}>
              {rangeText(option.cash.low, option.cash.high, signedMoney)}
            </p>
            <p className={styles.small}>Costs {costText(option.monthly, option.build)}.</p>
            <p className={styles.verdict} data-verdict={option.verdict}>
              <strong>{VERDICT_LABEL[option.verdict]}.</strong> {verdictText(option)}
            </p>
            <button
              type="button"
              className="button"
              data-variant={isBest ? "primary" : undefined}
              disabled={busy}
              onClick={() => onApply(option, isBest)}
            >
              {isBest ? "Make this change" : "Try it"}
            </button>
          </>
        ) : (
          <p className={styles.small}>Measuring on 60 simulated quarters…</p>
        )}
      </div>
    </li>
  );
}

/** A change that is already in place. */
function OnRow({ title, note, onRemove }: { title: string; note: string; onRemove(): void }) {
  return (
    <li className={styles.option} data-on>
      <div className={styles.main}>
        <p className={styles.tags}>
          <span className={styles.on}>In place</span>
        </p>
        <h4 className={styles.name}>{title}</h4>
        <p className={styles.what}>{note}</p>
      </div>
      <div className={styles.side}>
        <button type="button" className="button" onClick={onRemove}>
          Undo
        </button>
      </div>
    </li>
  );
}

/** One team: why work waits there, and what can be changed about it. */
export function StationPanel({
  station,
  onStation,
  scenario,
  readings,
  todayReadings,
  options,
  stale,
  busy,
  best,
  onApply,
  onSetup,
}: StationPanelProps) {
  const { setup } = scenario;
  const a = assumptionsFor(scenario.tweaks);
  const info = STATIONS[station];
  const index = STATION_INDEX[station];
  const reading = readings?.[index] ?? null;
  const before = todayReadings?.[index] ?? null;
  const measured = new Map((options ?? []).map((option) => [moveKey(option.move), option]));
  const bestKey = best ? moveKey(best.move) : null;
  const extra = extraPeople(setup, station);
  const levers = LEVER_IDS.filter((id) => LEVERS[id].station === station);
  const hire: Move = { kind: "hire", station };
  const scale = Math.max(reading?.waitHours ?? 0, before?.waitHours ?? 0);

  return (
    <section className={styles.panel} aria-labelledby="station-title">
      <fieldset className={styles.tabs}>
        <legend className="visually-hidden">Team to look at</legend>
        {STATION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.tab}
            aria-pressed={id === station}
            onClick={() => onStation(id)}
          >
            {STATIONS[id].name}
          </button>
        ))}
      </fieldset>

      <header className={styles.header}>
        <h2 id="station-title" className={styles.title}>
          {info.name}
          <span className={styles.team}>
            {info.team} · {peopleText(peopleAt(setup, station, a))}
          </span>
        </h2>
        <p className={styles.does}>{info.does}</p>
      </header>

      {reading ? (
        <div
          className={styles.reading}
          aria-busy={stale || undefined}
          data-busy={stale || undefined}
        >
          <p className={styles.cause}>{causeHeadline(reading)}</p>
          <p className={styles.why}>{causeDetail(reading, a)}</p>
          <dl className={styles.facts}>
            <div>
              <dt>
                Average wait<span className={styles.unit}>nights and weekends included</span>
              </dt>
              <dd>
                <p className={styles.fact}>
                  {duration(reading.waitHours)}
                  {before && Math.abs(before.waitHours - reading.waitHours) >= 0.05 ? (
                    <span className={styles.was}> · {duration(before.waitHours)} today</span>
                  ) : null}
                </p>
                <WaitBar reading={reading} scale={scale} />
              </dd>
            </div>
            <div>
              <dt>Work arriving</dt>
              <dd>
                <LoadMeter reading={reading} />
              </dd>
            </div>
            <div>
              <dt>Buyers who give up here</dt>
              <dd>
                <p className={styles.fact}>
                  {lostText(reading)}
                  {before && Math.abs(before.lostBuyers - reading.lostBuyers) >= 0.05 ? (
                    <span className={styles.was}> · {lostText(before)} today</span>
                  ) : null}
                </p>
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className={styles.small}>Simulating…</p>
      )}

      <h3 className={styles.heading}>What can change here</h3>
      <ul className={styles.options} aria-busy={busy || undefined}>
        {levers.map((id) =>
          hasLever(setup, id) ? (
            <OnRow
              key={id}
              title={LEVERS[id].name}
              note={LEVERS[id].mechanism}
              onRemove={() => onSetup(withLever(setup, id, false))}
            />
          ) : (
            <OpenRow
              key={id}
              move={{ kind: "lever", lever: id }}
              option={measured.get(moveKey({ kind: "lever", lever: id })) ?? null}
              scenario={scenario}
              isBest={bestKey === moveKey({ kind: "lever", lever: id })}
              busy={busy}
              onApply={onApply}
            />
          ),
        )}
        {extra > 0 ? (
          <OnRow
            title={`${extra} more ${plural(extra, info.role, `${info.role}s`)} hired`}
            note={`${peopleText(peopleAt(setup, station, a))} on this team now.`}
            onRemove={() => onSetup(withExtra(setup, station, extra - 1))}
          />
        ) : null}
        {extra < MAX_EXTRA_PEOPLE ? (
          <OpenRow
            move={hire}
            option={measured.get(moveKey(hire)) ?? null}
            scenario={scenario}
            isBest={bestKey === moveKey(hire)}
            busy={busy}
            onApply={onApply}
          />
        ) : null}
      </ul>
    </section>
  );
}
