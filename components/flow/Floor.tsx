"use client";

import { useEffect, useRef, useState } from "react";
import { clockLabel, DAY, WORK_DAY } from "@/core/flow/calendar";
import { peopleAt, STATION_IDS, STATIONS, type StationId, setupKey } from "@/core/flow/company";
import { assumptionsFor, type Scenario, tweaksKey } from "@/core/flow/scenario";
import { count, money, plural } from "@/lib/flow/format";
import { COUNTED_AT_OPENING, Live } from "@/lib/flow/live";
import { RUNS } from "@/lib/flow/view";
import styles from "./Floor.module.css";
import { type Geometry, heightFor, layout } from "./floor/geometry";
import { type Palette, Stage } from "./floor/stage";

/** Working minutes that pass per second: a nine-hour day in nine seconds. */
const PACE = 60;
/** Working days a time-lapse covers, and the seconds it takes. */
const LAPSE_DAYS = COUNTED_AT_OPENING;
const LAPSE_SECONDS = 2.6;
/** How often the numbers beside the drawing are refreshed. */
const HUD_MS = 250;

interface Hud {
  clock: string;
  week: number;
  waiting: number[];
  left: number[];
  leftBuyers: number[];
  pending: number;
  paid: number;
  paidValue: number;
  days: number;
  lapsing: boolean;
}

interface FloorProps {
  scenario: Scenario;
  /** The team where the best next move is. */
  flagged: StationId | null;
  selected: StationId | null;
  onSelect(station: StationId): void;
}

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const color = (name: string) => style.getPropertyValue(name).trim();
  return {
    ink: color("--ink"),
    rule: color("--rule"),
    ruleStrong: color("--rule-strong"),
    operable: color("--operable"),
    good: color("--good"),
    bad: color("--bad"),
    muted: color("--muted"),
    font: style.fontFamily,
  };
}

export function Floor({ scenario, flagged, selected, onSelect }: FloorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<Live | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const geometryRef = useRef<Geometry | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const control = useRef({
    paused: false,
    lapse: 0,
    lapseRate: 0,
    snap: true,
    visible: true,
    still: false,
  });
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [changed, setChanged] = useState(false);

  const assumptions = tweaksKey(scenario.tweaks);
  const setup = setupKey(scenario.setup);
  const people = STATION_IDS.map((id) =>
    peopleAt(scenario.setup, id, assumptionsFor(scenario.tweaks)),
  );
  const desks = people.join(",");
  const applied = useRef(setup);

  // A new set of assumptions means a different company: start it afresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilt only when the assumptions change; a change of setup is applied to the running company by the next effect
  useEffect(() => {
    liveRef.current = new Live(scenario);
    stageRef.current = new Stage(STATION_IDS.length);
    applied.current = setup;
    control.current.snap = true;
    control.current.lapse = 0;
    setChanged(false);
  }, [assumptions]);

  // A change of setup is applied to the running company, then a time-lapse shows where it settles.
  // biome-ignore lint/correctness/useExhaustiveDependencies: applies the setup named by `setup`; the scenario object is new on every render
  useEffect(() => {
    const live = liveRef.current;
    if (!live || applied.current === setup) return;
    applied.current = setup;
    live.apply(scenario.setup);
    stageRef.current?.clearTrays();
    setChanged(true);
    lapse();
  }, [setup]);

  // Desks are added and removed with people, so the drawing is laid out again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `desks` is the list of people as text
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      // The exact width, not the rounded one, so this agrees with the container query in the
      // stylesheet about when the teams are stacked.
      const width = wrap.getBoundingClientRect().width;
      if (width === 0) return;
      const height = heightFor(width, STATION_IDS.length);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.height = `${height}px`;
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      geometryRef.current = layout(width, people);
      paletteRef.current = readPalette(canvas);
      control.current.snap = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", resize);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", resize);
    };
  }, [desks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    control.current.still = still.matches;
    if (still.matches) {
      control.current.paused = true;
      setPaused(true);
    }
    const watcher = new IntersectionObserver(
      ([entry]) => {
        control.current.visible = entry?.isIntersecting ?? true;
      },
      { rootMargin: "120px" },
    );
    watcher.observe(wrap);

    let frame = 0;
    let last = performance.now();
    let sinceHud = HUD_MS;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = Math.min(100, time - last);
      last = time;
      const live = liveRef.current;
      const stage = stageRef.current;
      const geometry = geometryRef.current;
      const palette = paletteRef.current;
      const context = canvas.getContext("2d");
      const state = control.current;
      if (!live || !stage || !geometry || !palette || !context || !state.visible) return;
      let snap = state.snap;
      state.snap = false;
      if (state.lapse > 0) {
        // With reduced motion the time-lapse is a single jump.
        const step = state.still
          ? state.lapse
          : Math.min(state.lapse, (elapsed / 1000) * state.lapseRate);
        live.advance(step);
        state.lapse -= step;
        snap = snap || state.still;
      } else if (!state.paused) {
        live.advance((elapsed / 1000) * PACE);
      }
      stage.update(live, geometry, elapsed, snap);
      stage.draw(context, geometry, palette);
      sinceHud += elapsed;
      if (sinceHud >= HUD_MS || snap) {
        sinceHud = 0;
        let pending = 0;
        for (const item of live.sim.items) if (item.status === "paying") pending++;
        setHud({
          clock: clockLabel(live.wall),
          week: Math.floor(live.wall / (7 * DAY)) + 1,
          waiting: STATION_IDS.map((_, index) => {
            const station = live.sim.station(index);
            return station.held.length + station.queue.length;
          }),
          left: [...live.tallies.left],
          leftBuyers: [...live.tallies.leftBuyers],
          pending,
          paid: live.tallies.paid,
          paidValue: live.tallies.paidValue,
          days: live.daysCounted,
          lapsing: state.lapse > 0,
        });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  }, []);

  function lapse() {
    control.current.lapse = LAPSE_DAYS * WORK_DAY;
    control.current.lapseRate = (LAPSE_DAYS * WORK_DAY) / LAPSE_SECONDS;
  }

  function togglePause() {
    control.current.paused = !control.current.paused;
    setPaused(control.current.paused);
  }

  const span = Math.round(hud?.days ?? COUNTED_AT_OPENING);
  const spanText = `${count(span)} working ${plural(span, "day", "days")}`;

  return (
    <section className={styles.floor} aria-label="Larkspur, running">
      <div className={styles.bar}>
        <p className={styles.clock}>
          <span className="num">{hud?.clock ?? "Tue 10:30"}</span>
          <span className={styles.week}>
            {hud?.lapsing ? "four weeks pass…" : `week ${hud?.week ?? 11}`}
          </span>
        </p>
        <p className={styles.what}>
          Each dot is a customer request on its way from first message to paid invoice.
        </p>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            onClick={togglePause}
            aria-pressed={paused}
          >
            {paused ? "Play" : "Pause"}
          </button>
          <button type="button" className={styles.control} onClick={lapse}>
            Skip 4 weeks
          </button>
        </div>
      </div>

      <div className={styles.wrap} ref={wrapRef}>
        <div className={styles.cells}>
          {STATION_IDS.map((id, index) => {
            const info = STATIONS[id];
            const left = hud?.left[index] ?? 0;
            const buyers = hud?.leftBuyers[index] ?? 0;
            const staff = people[index] ?? 0;
            return (
              <button
                key={id}
                type="button"
                className={styles.cell}
                aria-pressed={selected === id}
                data-flagged={flagged === id || undefined}
                onClick={() => onSelect(id)}
              >
                <span className={styles.head}>
                  <span className={styles.name}>{info.name}</span>
                  <span className={styles.team}>{info.team}</span>
                  <span className={styles.count}>
                    <span className={styles.people}>
                      {staff} {plural(staff, "person", "people")} ·{" "}
                    </span>
                    <span className="num">{hud ? hud.waiting[index] : "–"}</span> waiting
                  </span>
                  {flagged === id ? (
                    <span className={`tag ${styles.flag}`} data-kind="key">
                      Best next move
                    </span>
                  ) : null}
                </span>
                <span className={styles.gone} data-some={left > 0 || undefined}>
                  {left > 0 ? (
                    <>
                      <span>
                        <span className="num">{left}</span> gave up
                      </span>
                      <span className={styles.buyers}>
                        <span className="num">{buyers}</span> would have bought
                      </span>
                    </>
                  ) : (
                    <span className={styles.zero}>nobody gave up</span>
                  )}
                </span>
              </button>
            );
          })}
          <div className={`${styles.cell} ${styles.cash}`}>
            <span className={styles.head}>
              <span className={styles.name}>Paid</span>
              <span className={styles.team}>Invoices out</span>
              <span className={styles.count}>
                <span className="num">{hud ? hud.pending : "–"}</span> unpaid
              </span>
            </span>
            <span className={styles.gone} data-good={(hud?.paid ?? 0) > 0 || undefined}>
              <span>
                <span className="num">{hud ? hud.paid : "–"}</span> paid
              </span>
              <span className={styles.buyers}>
                <span className="num">{money(hud?.paidValue ?? 0)}</span>
                <span className={styles.long}> collected</span>
              </span>
            </span>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="img"
          aria-label="Animated drawing of customer requests moving through Larkspur's five teams. The table under “Why the line forms” gives the same information as text."
        />
      </div>

      <div className={styles.under}>
        <ul className={styles.legend}>
          <li>
            <i data-look="held" /> waiting to be assigned
          </li>
          <li>
            <i data-look="queued" /> in line, paler as patience runs out
          </li>
          <li>
            <i data-look="working" /> being handled
          </li>
          <li>
            <i data-look="redo" /> sent back to be redone
          </li>
          <li>
            <i data-look="lostBuyer" /> gave up, would have bought
          </li>
          <li>
            <i data-look="lost" /> gave up, would not have bought
          </li>
          <li>
            <i data-look="paid" /> paid
          </li>
        </ul>
        <p className={styles.note}>
          One stream of made-up customers, simulated as you watch. A bigger dot is a bigger fleet.{" "}
          {changed
            ? `The counts cover the ${spanText} since your last change. Payments trail by weeks, so most of the cash counted here was sold before it.`
            : `The counts cover the last ${spanText} of this one stream; the figures below average ${RUNS} simulated quarters.`}
        </p>
      </div>
    </section>
  );
}
