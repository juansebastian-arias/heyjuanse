/**
 * How much does a result depend on each assumption? One assumption at a time is moved to a
 * plausibly lower and a plausibly higher value while the others stay put, and the result is
 * measured again on the same customers. The assumptions that move it most are the ones worth
 * checking against real data first.
 */
import { BASE } from "./company";
import { snap, TWEAK_IDS, TWEAKS, type TweakId, type Tweaks } from "./scenario";

export interface Variation {
  tweak: TweakId;
  side: "low" | "high";
  value: number;
  /** The visitor's assumptions with this one value replaced. */
  tweaks: Tweaks;
}

/** The value an assumption currently has under a visitor's tweaks. */
export function currentValue(tweaks: Tweaks, id: TweakId): number {
  const tweak = TWEAKS[id];
  return snap(tweak, tweaks[id] ?? tweak.read(BASE));
}

/** Every one-at-a-time variation of a set of assumptions. A side equal to the current value is skipped. */
export function variations(tweaks: Tweaks): Variation[] {
  const list: Variation[] = [];
  for (const id of TWEAK_IDS) {
    const tweak = TWEAKS[id];
    const current = currentValue(tweaks, id);
    for (const side of ["low", "high"] as const) {
      const value = snap(tweak, tweak[side]);
      if (value === current) continue;
      list.push({ tweak: id, side, value, tweaks: { ...tweaks, [id]: value } });
    }
  }
  return list;
}

export interface Swing {
  tweak: TweakId;
  /** The assumption's current value, and the result with it. */
  current: number;
  base: number;
  /** The result with the assumption at its lower and higher value. Null where that side was skipped. */
  low: { value: number; result: number } | null;
  high: { value: number; result: number } | null;
  /** The widest gap between any two of those results. */
  spread: number;
}

/** Groups measured variations by assumption, widest swing first. */
export function swings(
  tweaks: Tweaks,
  base: number,
  measured: ReadonlyArray<{ variation: Variation; result: number }>,
): Swing[] {
  return TWEAK_IDS.map((id): Swing => {
    const side = (which: "low" | "high") => {
      const hit = measured.find((m) => m.variation.tweak === id && m.variation.side === which);
      return hit ? { value: hit.variation.value, result: hit.result } : null;
    };
    const low = side("low");
    const high = side("high");
    const results = [base, low?.result, high?.result].filter(
      (value): value is number => value !== undefined,
    );
    return {
      tweak: id,
      current: currentValue(tweaks, id),
      base,
      low,
      high,
      spread: Math.max(...results) - Math.min(...results),
    };
  }).sort((x, y) => y.spread - x.spread);
}
