"use client";

import { useEffect, useRef, useState } from "react";
import { BASE, type Setup, setupKey } from "@/core/flow/company";
import type { Option } from "@/core/flow/planner";
import {
  assumptionsFor,
  isChanged,
  normalizeTweaks,
  type Scenario,
  snap,
  TWEAK_IDS,
  TWEAKS,
  type Tweak,
  type Tweaks,
  tweaksKey,
} from "@/core/flow/scenario";
import { type Swing, variations } from "@/core/flow/sensitivity";
import { assumptionGroups } from "@/lib/flow/assumptions";
import { plural, signedMoney } from "@/lib/flow/format";
import { Cancelled } from "@/lib/flow/pool";
import type { FlowStore } from "@/lib/flow/store";
import { RUNS } from "@/lib/flow/view";
import styles from "../Inside.module.css";

interface AssumptionsPanelProps {
  scenario: Scenario;
  plan: readonly Option[];
  store: FlowStore;
  onTweaks(tweaks: Tweaks): void;
}

/** How long after the last movement of a slider the company is simulated again. */
const COMMIT_AFTER_MS = 350;

export function tweakValue(tweak: Tweak, value: number): string {
  switch (tweak.unit) {
    case "$":
      return `$${value}`;
    case "%":
      return `${value}%`;
    case "days":
      return `${value} ${plural(value, "day", "days")}`;
    case "min":
      return `${value} min`;
    case "times":
      return value === 1 ? "once" : `${value} times`;
    default:
      return `${value}`;
  }
}

type Test =
  | { kind: "idle" }
  | { kind: "running"; share: number }
  | { kind: "done"; swings: Swing[]; key: string; mine: boolean }
  | { kind: "error"; message: string };

function Tornado({ swings }: { swings: readonly Swing[] }) {
  const base = swings[0]?.base ?? 0;
  const values = [0, base];
  for (const swing of swings) {
    if (swing.low) values.push(swing.low.result);
    if (swing.high) values.push(swing.high.result);
  }
  const min = Math.min(...values);
  const span = Math.max(1, Math.max(...values) - min);
  const x = (value: number) => ((value - min) / span) * 100;
  const bar = (result: number) => ({
    left: `${Math.min(x(base), x(result))}%`,
    width: `${Math.abs(x(result) - x(base))}%`,
  });
  return (
    <div className={styles.tornado}>
      <ul className={styles.legend}>
        <li>
          <i data-side="low" /> with the lower value
        </li>
        <li>
          <i data-side="high" /> with the higher value
        </li>
        <li>
          <i data-side="base" /> as set now: {signedMoney(base)} a month
        </li>
      </ul>
      <ol className={styles.swings}>
        {swings.map((swing) => {
          const tweak = TWEAKS[swing.tweak];
          return (
            <li key={swing.tweak}>
              <p className={styles.swingLabel}>
                {tweak.label}
                <span className={styles.before}>now {tweakValue(tweak, swing.current)}</span>
              </p>
              <div className={styles.track} aria-hidden="true">
                <span className={styles.baseline} style={{ left: `${x(base)}%` }} />
                {swing.low ? (
                  <span
                    className={styles.swing}
                    data-side="low"
                    data-toward={swing.low.result < base ? "left" : "right"}
                    style={bar(swing.low.result)}
                  />
                ) : null}
                {swing.high ? (
                  <span
                    className={styles.swing}
                    data-side="high"
                    data-toward={swing.high.result < base ? "left" : "right"}
                    style={bar(swing.high.result)}
                  />
                ) : null}
              </div>
              <p className={styles.swingValues}>
                {swing.low ? (
                  <span>
                    <i data-side="low" /> {tweakValue(tweak, swing.low.value)}:{" "}
                    <b>{signedMoney(swing.low.result)}</b>
                  </span>
                ) : null}
                {swing.high ? (
                  <span>
                    <i data-side="high" /> {tweakValue(tweak, swing.high.value)}:{" "}
                    <b>{signedMoney(swing.high.result)}</b>
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The assumptions a visitor can replace, a test of how much the result leans on each, and the rest. */
export function AssumptionsPanel({ scenario, plan, store, onTweaks }: AssumptionsPanelProps) {
  const [draft, setDraft] = useState<Tweaks>(scenario.tweaks);
  const [synced, setSynced] = useState(tweaksKey(scenario.tweaks));
  const [test, setTest] = useState<Test>({ kind: "idle" });
  const timer = useRef<number | null>(null);

  // The scenario can change from outside (a link, "Start over"): the sliders follow it.
  const current = tweaksKey(scenario.tweaks);
  if (current !== synced) {
    setSynced(current);
    setDraft(scenario.tweaks);
  }

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function change(tweak: Tweak, value: number) {
    const next = normalizeTweaks({ ...draft, [tweak.id]: snap(tweak, value) });
    setDraft(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSynced(tweaksKey(next));
      onTweaks(next);
    }, COMMIT_AFTER_MS);
  }

  function resetAll() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setDraft({});
    setSynced("");
    onTweaks({});
  }

  const changed = isChanged(scenario.setup);
  const target: Setup | null = changed ? scenario.setup : (plan[plan.length - 1]?.setup ?? null);
  const targetKey = target ? `${setupKey(target)}/${current}` : "";

  async function runTest() {
    if (!target) return;
    setTest({ kind: "running", share: 0 });
    try {
      const swings = await store.sensitivity(target, scenario.tweaks, (share) =>
        setTest((state) => (state.kind === "running" ? { kind: "running", share } : state)),
      );
      setTest({ kind: "done", swings, key: targetKey, mine: changed });
    } catch (error) {
      setTest(
        error instanceof Cancelled
          ? { kind: "idle" }
          : { kind: "error", message: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  const a = assumptionsFor(scenario.tweaks);
  const replaced = Object.keys(normalizeTweaks(draft)).length;
  const tried = variations(scenario.tweaks).length;

  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        Larkspur is made up, so every result rests on assumptions. These seven matter most. Move one
        and the whole company is simulated again with it.
      </p>
      <div className={styles.sliders}>
        {TWEAK_IDS.map((id) => {
          const tweak = TWEAKS[id];
          const start = snap(tweak, tweak.read(BASE));
          const value = draft[id] ?? start;
          return (
            <label key={id} className={styles.slider}>
              <span className={styles.sliderLabel}>{tweak.label}</span>
              <span className={styles.sliderValue}>
                {tweakValue(tweak, value)}
                {value !== start ? (
                  <span className={styles.before}>started at {tweakValue(tweak, start)}</span>
                ) : null}
              </span>
              <input
                type="range"
                min={tweak.min}
                max={tweak.max}
                step={tweak.step}
                value={value}
                onChange={(event) => change(tweak, Number(event.target.value))}
              />
            </label>
          );
        })}
      </div>
      {replaced > 0 ? (
        <p>
          <button type="button" className={styles.textButton} onClick={resetAll}>
            Put all {replaced === 1 ? "of it" : `${replaced}`} back
          </button>
        </p>
      ) : null}

      <section className={styles.block}>
        <h3 className={styles.heading}>Which assumption does the result lean on most?</h3>
        <p className={styles.note}>
          One assumption at a time is moved to a lower and a higher value, and the gain from{" "}
          {changed ? "your changes" : "the model's whole plan"} over today's company is measured
          again on the same customers: {tried} variations, {RUNS} quarters each. The widest bars are
          the assumptions to check against real data first.
        </p>
        {target ? (
          <p>
            <button
              type="button"
              className="button"
              onClick={runTest}
              disabled={test.kind === "running"}
            >
              {test.kind === "done" ? "Run it again" : "Test the assumptions"}
            </button>
          </p>
        ) : (
          <p className={styles.note}>There is no change to test under these assumptions.</p>
        )}
        <div aria-live="polite">
          {test.kind === "running" ? (
            <p className={styles.note}>
              Simulating… {Math.round(test.share * 100)}% done.
              <progress className={styles.progress} max={1} value={test.share} />
            </p>
          ) : null}
          {test.kind === "error" ? (
            <p className={styles.error}>The test could not run: {test.message}</p>
          ) : null}
          {test.kind === "done" ? (
            <>
              {test.key !== targetKey ? (
                <p className={styles.note}>
                  The setup has changed since this was measured. Run it again for the current one.
                </p>
              ) : null}
              <p className={styles.note}>
                Sales collected a month, {test.mine ? "your changes" : "the whole plan"} minus
                today's company.
              </p>
              <Tornado swings={test.swings} />
            </>
          ) : null}
        </div>
      </section>

      <details className={styles.details}>
        <summary>Every other number the model takes as given</summary>
        {assumptionGroups(a).map((group) => (
          <table key={group.title} className={styles.table}>
            <caption>{group.title}</caption>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </details>
    </div>
  );
}
