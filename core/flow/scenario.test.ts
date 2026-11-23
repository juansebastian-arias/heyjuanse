import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BASE,
  LEVER_IDS,
  MAX_EXTRA_PEOPLE,
  type Setup,
  STATION_IDS,
  setupKey,
  TODAY,
} from "./company";
import {
  assumptionsFor,
  decodeScenario,
  encodeScenario,
  isChanged,
  normalizeTweaks,
  type Scenario,
  START,
  snap,
  TWEAK_IDS,
  TWEAKS,
  type Tweaks,
  tweaksKey,
} from "./scenario";

const anySetup: fc.Arbitrary<Setup> = fc.record({
  on: fc.subarray([...LEVER_IDS]),
  extra: fc.dictionary(
    fc.constantFrom(...STATION_IDS),
    fc.integer({ min: 0, max: MAX_EXTRA_PEOPLE }),
  ),
});

const anyTweaks: fc.Arbitrary<Tweaks> = fc
  .tuple(
    ...TWEAK_IDS.map((id) =>
      fc.option(fc.double({ min: TWEAKS[id].min, max: TWEAKS[id].max, noNaN: true })),
    ),
  )
  .map((values) => {
    const tweaks: Record<string, number> = {};
    TWEAK_IDS.forEach((id, index) => {
      const value = values[index];
      if (value !== null && value !== undefined) tweaks[id] = value;
    });
    return tweaks as Tweaks;
  });

const sameScenario = (a: Scenario, b: Scenario) => {
  expect(setupKey(a.setup)).toBe(setupKey(b.setup));
  expect(tweaksKey(a.tweaks)).toBe(tweaksKey(b.tweaks));
};

describe("a scenario in a link", () => {
  it("is empty for the starting point", () => {
    expect(encodeScenario(START)).toBe("");
    sameScenario(decodeScenario(""), START);
  });

  it("reads like what it says", () => {
    const scenario: Scenario = {
      setup: { on: ["replyDrafts", "routing"], extra: { quote: 1 } },
      tweaks: { demand: 16 },
    };
    expect(encodeScenario(scenario)).toBe("on=routing,replyDrafts&hire=quote:1&if=demand:16");
  });

  it("comes back the same after a round trip", () => {
    fc.assert(
      fc.property(anySetup, anyTweaks, (setup, tweaks) => {
        const scenario = { setup, tweaks };
        const back = decodeScenario(encodeScenario(scenario));
        sameScenario(back, scenario);
        expect(encodeScenario(back)).toBe(encodeScenario(scenario));
      }),
    );
  });

  it("turns any text at all into a valid scenario", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const scenario = decodeScenario(text);
        for (const id of scenario.setup.on) expect(LEVER_IDS).toContain(id);
        for (const [station, people] of Object.entries(scenario.setup.extra)) {
          expect(STATION_IDS).toContain(station);
          expect(people).toBeGreaterThanOrEqual(1);
          expect(people).toBeLessThanOrEqual(MAX_EXTRA_PEOPLE);
        }
        for (const id of TWEAK_IDS) {
          const value = scenario.tweaks[id];
          if (value === undefined) continue;
          expect(value).toBeGreaterThanOrEqual(TWEAKS[id].min);
          expect(value).toBeLessThanOrEqual(TWEAKS[id].max);
        }
      }),
    );
  });

  it("drops what it does not know and clamps what is out of range", () => {
    const scenario = decodeScenario(
      "on=routing,teleport,routing&hire=quote:9,moon:1,reply:0,setup:x&if=demand:999,patience:abc,nonsense:3,price:",
    );
    expect(scenario.setup.on).toEqual(["routing"]);
    expect(scenario.setup.extra).toEqual({ quote: MAX_EXTRA_PEOPLE });
    expect(scenario.tweaks).toEqual({ demand: TWEAKS.demand.max });
  });

  it("does not run code or keep markup from a link", () => {
    const scenario = decodeScenario("on=<script>alert(1)</script>&if=demand:1e999,__proto__:1");
    sameScenario(scenario, START);
    expect(Object.getPrototypeOf(scenario.tweaks)).toBe(Object.prototype);
  });
});

describe("assumptions a visitor can replace", () => {
  it("each start at the base value, inside their own range and on a step", () => {
    for (const id of TWEAK_IDS) {
      const tweak = TWEAKS[id];
      const base = tweak.read(BASE);
      expect(base).toBeGreaterThanOrEqual(tweak.min);
      expect(base).toBeLessThanOrEqual(tweak.max);
      expect(snap(tweak, base)).toBeCloseTo(base, 9);
      expect(snap(tweak, tweak.low)).toBe(tweak.low);
      expect(snap(tweak, tweak.high)).toBe(tweak.high);
      expect(tweak.low).toBeLessThanOrEqual(base);
      expect(tweak.high).toBeGreaterThanOrEqual(base);
    }
  });

  it("change the one thing they name", () => {
    for (const id of TWEAK_IDS) {
      const tweak = TWEAKS[id];
      const changed = assumptionsFor({ [id]: tweak.high });
      expect(tweak.read(changed)).toBeCloseTo(tweak.high, 9);
      for (const other of TWEAK_IDS) {
        if (other !== id) expect(TWEAKS[other].read(changed)).toBe(TWEAKS[other].read(BASE));
      }
    }
  });

  it("leave the base assumptions alone", () => {
    const before = JSON.stringify(BASE);
    assumptionsFor({ demand: 20, patience: 4, errors: 0, handouts: 3 });
    expect(JSON.stringify(BASE)).toBe(before);
    expect(assumptionsFor({})).toBe(BASE);
  });

  it("scale weekend requests with weekday requests", () => {
    const a = assumptionsFor({ demand: 21 });
    expect(a.requestsPerWeekendDay / a.requestsPerWeekday).toBeCloseTo(
      BASE.requestsPerWeekendDay / BASE.requestsPerWeekday,
      9,
    );
  });

  it("treat a tweak equal to the base value as no tweak", () => {
    expect(normalizeTweaks({ demand: BASE.requestsPerWeekday, accept: 40.4 })).toEqual({});
    expect(tweaksKey({ demand: 14 })).toBe("");
    expect(tweaksKey({ patience: 1.2, demand: 17.6 })).toBe("demand:18,patience:1");
  });

  it("snap to steps and stay in range", () => {
    expect(snap(TWEAKS.patience, 1.3)).toBe(1.5);
    expect(snap(TWEAKS.patience, 99)).toBe(TWEAKS.patience.max);
    expect(snap(TWEAKS.demand, -4)).toBe(TWEAKS.demand.min);
  });
});

describe("a setup", () => {
  it("counts as changed once an improvement is on or a person is added", () => {
    expect(isChanged(TODAY)).toBe(false);
    expect(isChanged({ on: [], extra: { quote: 0 } })).toBe(false);
    expect(isChanged({ on: ["routing"], extra: {} })).toBe(true);
    expect(isChanged({ on: [], extra: { quote: 1 } })).toBe(true);
  });
});
