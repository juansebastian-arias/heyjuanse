import { STATION_IDS, STATIONS } from "@/core/flow/company";
import styles from "./Lifecycle.module.css";

/** The drawing is 400 units wide; every position below is in those units. */
const WIDTH = 400;
const HEIGHT = 412;
const CHIP = { w: 58, h: 24, y: 4 };
const STATE = { x: 4, w: 180, h: 42 };
const SIDE = { x: 252, w: 144, h: 42 };
const MID = STATE.x + STATE.w / 2;
const EDGE = STATE.x + STATE.w;

interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  look?: "state" | "choice" | "lost" | "aside";
}

function Box({ x, y, w, h, title, sub, look = "state" }: BoxProps) {
  return (
    <g>
      <rect className={styles.box} data-look={look} x={x} y={y} width={w} height={h} rx={4} />
      <text className={styles.title} data-look={look} x={x + 10} y={y + 18}>
        {title}
      </text>
      <text className={styles.sub} x={x + 10} y={y + 33}>
        {sub}
      </text>
    </g>
  );
}

/** A straight arrow down the main column, with what triggers it written beside it. */
function Down({ from, to, label }: { from: number; to: number; label?: string }) {
  return (
    <g>
      <path className={styles.line} d={`M${MID} ${from}V${to}`} markerEnd="url(#lifecycle-head)" />
      {label ? (
        <text className={styles.label} x={MID + 8} y={(from + to) / 2 + 4}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

/**
 * The states a request passes through, drawn: the line of teams on top, and under it what
 * happens inside each one. The same rules are written out next to the drawing.
 */
export function Lifecycle() {
  const steps = [...STATION_IDS.map((id) => STATIONS[id].name), "Paid"];
  const pitch = (WIDTH - CHIP.w) / (steps.length - 1);
  const teamsEnd = (STATION_IDS.length - 1) * pitch + CHIP.w;
  const a = 92;
  const b = 160;
  const c = 228;
  const d = 296;
  const e = 364;
  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-labelledby="lifecycle-title lifecycle-desc"
    >
      <title id="lifecycle-title">How a request moves through Larkspur</title>
      <desc id="lifecycle-desc">
        A request passes five teams in a row and is then paid. Inside each team it waits to be
        assigned, waits in line and is handled. While it waits the customer can give up. Handled
        work can be sent back and returns to the line. After a step the customer may leave by
        choice; otherwise the request goes on to the next team.
      </desc>
      <defs>
        <marker
          id="lifecycle-head"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6.5"
          markerHeight="6.5"
          orient="auto"
        >
          <path className={styles.head} d="M0 0.6L7.4 4L0 7.4z" />
        </marker>
        <marker
          id="lifecycle-head-lost"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6.5"
          markerHeight="6.5"
          orient="auto"
        >
          <path className={styles.head} data-look="lost" d="M0 0.6L7.4 4L0 7.4z" />
        </marker>
      </defs>

      {steps.map((name, index) => {
        const x = index * pitch;
        const last = index === steps.length - 1;
        return (
          <g key={name}>
            <rect
              className={styles.chip}
              data-look={last ? "paid" : undefined}
              x={x + 0.5}
              y={CHIP.y}
              width={CHIP.w - 1}
              height={CHIP.h}
              rx={12}
            />
            <text className={styles.chipText} x={x + CHIP.w / 2} y={CHIP.y + 16}>
              {name}
            </text>
            {last ? null : (
              <path
                className={styles.head}
                d={`M${x + CHIP.w + 2.5} ${CHIP.y + 8.5}l5.5 3.5l-5.5 3.5z`}
              />
            )}
          </g>
        );
      })}
      <path className={styles.bracket} d={`M0.5 33v5H${teamsEnd - 0.5}v-5`} />
      <text className={styles.label} x={0} y={56}>
        Inside each of the five teams, a request is in one of these states:
      </text>

      <circle className={styles.dot} cx={MID} cy={72} r={3.5} />
      <text className={styles.label} x={MID + 8} y={75.5}>
        arrives
      </text>
      <Down from={76} to={a} />
      <Box {...STATE} y={a} title="Waiting to be assigned" sub="nobody owns it yet" />
      <Down from={a + STATE.h} to={b} label="the next hand-out" />
      <Box {...STATE} y={b} title="In line" sub="first come, first served" />
      <Down from={b + STATE.h} to={c} label="a person is free" />
      <Box {...STATE} y={c} title="Being handled" sub="during office hours" />
      <Down from={c + STATE.h} to={d} label="done" />
      <Box
        {...STATE}
        y={d}
        look="choice"
        title="The customer decides"
        sub="after reply, quote, contract"
      />
      <Down from={d + STATE.h} to={e} label="stays" />
      <Box
        {...STATE}
        y={e}
        look="aside"
        title="Next team, or payment"
        sub="payment follows the last team"
      />

      {/* Giving up: from either waiting state. */}
      <Box {...SIDE} y={126} look="lost" title="Gave up waiting" sub="patience ran out" />
      <path
        className={styles.line}
        data-look="lost"
        d={`M${EDGE} ${a + 21}H${SIDE.x + 72}V126`}
        markerEnd="url(#lifecycle-head-lost)"
      />
      <path
        className={styles.line}
        data-look="lost"
        d={`M${EDGE} ${b + 21}H${SIDE.x + 72}V${126 + SIDE.h}`}
        markerEnd="url(#lifecycle-head-lost)"
      />

      {/* Sent back: out of handling, and into the line again after a delay. */}
      <Box {...SIDE} y={c} look="aside" title="Sent back" sub="returns after a delay" />
      <path
        className={styles.line}
        d={`M${EDGE} ${c + 21}H${SIDE.x}`}
        markerEnd="url(#lifecycle-head)"
      />
      <text className={styles.label} x={EDGE + 8} y={c + 15}>
        a mistake
      </text>
      <path
        className={styles.line}
        d={`M${SIDE.x + 108} ${c}V${b + 34}H${EDGE}`}
        markerEnd="url(#lifecycle-head)"
      />

      {/* Leaving by choice. */}
      <Box {...SIDE} y={d} look="aside" title="Left by choice" sub="not a fit, or said no" />
      <path
        className={styles.line}
        d={`M${EDGE} ${d + 21}H${SIDE.x}`}
        markerEnd="url(#lifecycle-head)"
      />
      <text className={styles.label} x={EDGE + 8} y={d + 15}>
        leaves
      </text>
    </svg>
  );
}
