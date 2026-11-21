"use client";

import { useEffect, useMemo, useState } from "react";
import { compareMotions, decide, type Move } from "@/core/gtm/decide";
import {
  ALL_OFF,
  ALL_ON,
  AUTOMATION_IDS,
  AUTOMATIONS,
  type AutomationId,
  type Automations,
  MOTION_IDS,
  MOTIONS,
  type MotionId,
  TEAM,
} from "@/core/gtm/model";
import { Assumptions } from "./Assumptions";
import { DecisionPath, type PathStep } from "./DecisionPath";
import { FlowDiagram } from "./FlowDiagram";
import { formatHours, formatMoney, formatSigned, formatSignedMoney } from "./format";
import styles from "./Simulator.module.css";
import { WeeklyChart } from "./WeeklyChart";

function moveLabel(move: Move): string {
  return `${move.turnOn ? "Switch on" : "Switch off"}: ${AUTOMATIONS[move.automation].name}`;
}

export function Simulator() {
  const [motion, setMotion] = useState<MotionId>("inbound");
  const [automations, setAutomations] = useState<Automations>(ALL_OFF);
  const [log, setLog] = useState<PathStep[]>([]);
  const [start, setStart] = useState<{ meetings: number; costPerMeeting: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  const decision = useMemo(() => decide(motion, automations), [motion, automations]);
  const motions = useMemo(() => compareMotions(automations), [automations]);
  const { current, baseline, next, moves, contributions } = decision;
  const isManual = AUTOMATION_IDS.every((id) => !automations[id]);
  const top = contributions[0];

  const clearPath = () => {
    setLog([]);
    setStart(null);
    setPlaying(false);
  };
  const reset = (preset: Automations) => {
    setAutomations(preset);
    clearPath();
  };
  const pickMotion = (id: MotionId) => {
    setMotion(id);
    clearPath();
  };
  const toggle = (id: AutomationId) => {
    setAutomations((prev) => ({ ...prev, [id]: !prev[id] }));
    clearPath();
  };
  const apply = (move: Move) => {
    if (!log.length)
      setStart({ meetings: current.meetings, costPerMeeting: current.costPerMeeting });
    setAutomations((prev) => ({ ...prev, [move.automation]: move.turnOn }));
    setLog((prev) => [
      ...prev,
      {
        label: `${move.turnOn ? "" : "Off: "}${AUTOMATIONS[move.automation].short}`,
        delta: move.deltaMeetings,
        meetings: current.meetings + move.deltaMeetings,
        costPerMeeting: current.costPerMeeting + move.deltaCostPerMeeting,
      },
    ]);
  };

  // "Follow the data": keep applying the recommendation, one step at a time, until none is left.
  useEffect(() => {
    if (!playing) return;
    if (!next) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => apply(next), log.length ? 900 : 0);
    return () => window.clearTimeout(timer);
  });

  const kpis = [
    {
      label: "Meetings booked",
      value: current.meetings.toLocaleString("en-US"),
      delta: isManual ? null : `${formatSigned(current.meetings - baseline.meetings)} vs manual`,
      good: current.meetings >= baseline.meetings,
    },
    {
      label: "Pipeline created",
      value: formatMoney(current.pipeline),
      delta: isManual
        ? null
        : `${formatSignedMoney(current.pipeline - baseline.pipeline)} vs manual`,
      good: current.pipeline >= baseline.pipeline,
    },
    {
      label: "Cost per meeting",
      value: formatMoney(current.costPerMeeting),
      delta: isManual
        ? null
        : `${formatSignedMoney(current.costPerMeeting - baseline.costPerMeeting)} vs manual`,
      good: current.costPerMeeting <= baseline.costPerMeeting,
    },
    {
      label: "Time to first touch",
      value: formatHours(current.medianHoursToTouch),
      delta: isManual ? null : `was ${formatHours(baseline.medianHoursToTouch)}`,
      good: current.medianHoursToTouch <= baseline.medianHoursToTouch,
    },
  ];

  return (
    <div className={styles.sim}>
      <fieldset className={styles.motions}>
        <legend className="eyebrow">1 · Pick a go-to-market strategy</legend>
        <div className={styles.motionList}>
          {MOTION_IDS.map((id) => (
            <label key={id} className={styles.motion} data-active={id === motion || undefined}>
              <input
                type="radio"
                name="motion"
                value={id}
                checked={id === motion}
                onChange={() => pickMotion(id)}
              />
              <span className={styles.motionName}>{MOTIONS[id].name}</span>
              <span className={styles.motionShort}>{MOTIONS[id].short}</span>
              <span className={`num ${styles.motionMeta}`}>
                {MOTIONS[id].leads.toLocaleString("en-US")} leads ·{" "}
                {formatMoney(MOTIONS[id].dealSize)} deals
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.grid}>
        <fieldset className={styles.controls}>
          <legend className="eyebrow">2 · Switch automations on and off</legend>
          <ul className={styles.switches}>
            {AUTOMATION_IDS.map((id) => {
              const automation = AUTOMATIONS[id];
              const on = automations[id];
              return (
                <li key={id} className={styles.switchRow} data-on={on || undefined}>
                  <label className={styles.switchLabel}>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={on}
                      checked={on}
                      onChange={() => toggle(id)}
                      className={styles.switchInput}
                    />
                    <span className={styles.switchTrack} aria-hidden="true" />
                    <span className={styles.switchText}>
                      <span className={styles.switchName}>{automation.name}</span>
                      <span className={styles.switchWhat}>{automation.what}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className={styles.presets}>
            <button type="button" className="button" onClick={() => reset(ALL_OFF)}>
              All manual
            </button>
            <button type="button" className="button" onClick={() => reset(ALL_ON)}>
              All automated
            </button>
          </div>
        </fieldset>

        <div className={styles.results} aria-live="polite">
          <p className="eyebrow">3 · See 90 days play out</p>
          <dl className={styles.kpis}>
            {kpis.map((kpi) => (
              <div key={kpi.label} className={styles.kpi}>
                <dt>{kpi.label}</dt>
                <dd className={`num ${styles.kpiValue}`}>{kpi.value}</dd>
                {kpi.delta ? (
                  <dd className={styles.kpiDelta} data-good={kpi.good || undefined}>
                    {kpi.delta}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>

          <div className={styles.decision}>
            <p className={styles.decisionKicker}>The data says</p>
            {next ? (
              <>
                <p className={styles.decisionText}>
                  <strong>{moveLabel(next)}.</strong> It adds{" "}
                  <span className="num">{next.deltaMeetings}</span> meetings and{" "}
                  <span className="num">{formatMoney(next.deltaPipeline)}</span> in pipeline
                  {next.deltaCostPerMeeting < 0 ? (
                    <>
                      , and each meeting gets{" "}
                      <span className="num">{formatMoney(-next.deltaCostPerMeeting)}</span> cheaper
                    </>
                  ) : null}
                  .
                  {!next.turnOn
                    ? " With the other automations freeing up rep time, this rule now holds back good leads."
                    : ""}
                </p>
                <div className={styles.decisionActions}>
                  <button
                    type="button"
                    className="button"
                    data-variant="primary"
                    onClick={() => apply(next)}
                    disabled={playing}
                  >
                    Apply this decision
                  </button>
                  <button
                    type="button"
                    className="button"
                    data-variant="quiet"
                    onClick={() => setPlaying(true)}
                    disabled={playing}
                  >
                    Follow the data to the end
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.decisionText}>
                <strong>No single switch adds more meetings from here.</strong>{" "}
                {top
                  ? `The biggest driver is “${AUTOMATIONS[top.automation].name}”: without it, ${Math.abs(top.deltaMeetings)} fewer meetings.`
                  : ""}{" "}
                Next step would be a new channel, not another automation: compare strategies below.
              </p>
            )}
            {log.length && start ? <DecisionPath start={start} steps={log} /> : null}
          </div>

          <FlowDiagram result={current} automations={automations} />
          <WeeklyChart current={current.weeklyMeetings} manual={baseline.weeklyMeetings} />

          <details className={styles.moves}>
            <summary>Every possible next switch, measured</summary>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Move</th>
                  <th scope="col" className={styles.right}>
                    Meetings
                  </th>
                  <th scope="col" className={styles.right}>
                    Cost per meeting
                  </th>
                  <th scope="col" className={styles.right}>
                    Rep hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {moves.map((move) => (
                  <tr key={move.automation}>
                    <th scope="row">{moveLabel(move)}</th>
                    <td className={`num ${styles.right}`}>{formatSigned(move.deltaMeetings)}</td>
                    <td className={`num ${styles.right}`}>
                      {formatSignedMoney(move.deltaCostPerMeeting)}
                    </td>
                    <td className={`num ${styles.right}`}>
                      {formatSigned(Math.round(move.deltaRepHours))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </div>

      <section className={styles.compare} aria-labelledby="compare-title">
        <h3 id="compare-title" className={styles.compareTitle}>
          Same automations, every strategy: where should the next dollar go?
        </h3>
        <section
          className={styles.tableWrap}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs a tab stop so its overflow can be scrolled by keyboard
          tabIndex={0}
          aria-label="Strategies compared"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Strategy</th>
                <th scope="col" className={styles.right}>
                  Meetings
                </th>
                <th scope="col" className={styles.right}>
                  Pipeline
                </th>
                <th scope="col" className={styles.right}>
                  Cost per meeting
                </th>
                <th scope="col" className={styles.right}>
                  Real needs missed
                </th>
              </tr>
            </thead>
            <tbody>
              {motions.map((row, index) => (
                <tr key={row.motion} data-current={row.motion === motion || undefined}>
                  <th scope="row">
                    {MOTIONS[row.motion].name}
                    {index === 0 ? (
                      <span className="tag" data-kind="key">
                        Cheapest meetings
                      </span>
                    ) : null}
                  </th>
                  <td className={`num ${styles.right}`}>{row.result.meetings}</td>
                  <td className={`num ${styles.right}`}>{formatMoney(row.result.pipeline)}</td>
                  <td className={`num ${styles.right}`}>
                    {formatMoney(row.result.costPerMeeting)}
                  </td>
                  <td className={`num ${styles.right}`}>{row.result.missedNeeds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className={styles.note}>
          Cost per meeting includes lead cost, rep time at {formatMoney(TEAM.costPerRepHour)} an
          hour and the tools that are switched on. &ldquo;Real needs missed&rdquo; counts leads that
          had a need but never reached a rep.
        </p>
      </section>

      <Assumptions />
    </div>
  );
}
