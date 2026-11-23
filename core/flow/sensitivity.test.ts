import { describe, expect, it } from "vitest";
import { BASE } from "./company";
import { TWEAK_IDS, TWEAKS } from "./scenario";
import { currentValue, swings, variations } from "./sensitivity";

describe("one-at-a-time variations", () => {
  it("move each assumption down and up, skipping a side that would change nothing", () => {
    const list = variations({});
    // Hand-outs already sit at their lower value, once a day.
    expect(list).toHaveLength(TWEAK_IDS.length * 2 - 1);
    expect(list.some((v) => v.tweak === "handouts" && v.side === "low")).toBe(false);
    for (const v of list) {
      expect(v.value).toBe(TWEAKS[v.tweak][v.side]);
      expect(Object.keys(v.tweaks)).toEqual([v.tweak]);
    }
  });

  it("keep the visitor's other assumptions in place", () => {
    const list = variations({ demand: 18, patience: 1 });
    const price = list.find((v) => v.tweak === "price" && v.side === "high");
    expect(price?.tweaks).toEqual({ demand: 18, patience: 1, price: TWEAKS.price.high });
    // Patience already sits at its lower test value.
    expect(list.some((v) => v.tweak === "patience" && v.side === "low")).toBe(false);
  });

  it("read an assumption's current value", () => {
    expect(currentValue({}, "demand")).toBe(BASE.requestsPerWeekday);
    expect(currentValue({ demand: 17 }, "demand")).toBe(17);
  });
});

describe("swings", () => {
  it("put the assumption that moves the result most first", () => {
    const list = variations({});
    const measured = list.map((variation) => ({
      variation,
      result: variation.tweak === "patience" ? (variation.side === "low" ? 80 : 10) : 41,
    }));
    const ranked = swings({}, 40, measured);
    expect(ranked).toHaveLength(TWEAK_IDS.length);
    expect(ranked[0]?.tweak).toBe("patience");
    expect(ranked[0]?.spread).toBe(70);
    expect(ranked[1]?.spread).toBe(1);
    const handouts = ranked.find((s) => s.tweak === "handouts");
    expect(handouts?.low).toBeNull();
    expect(handouts?.high?.result).toBe(41);
  });
});
