import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  cvOf,
  type Dist,
  lognormalFromMedian,
  lognormalShareBelow,
  meanOf,
  medianOf,
  normalCdf,
  normalQuantile,
  quantile,
} from "./dist";

const anyDist: fc.Arbitrary<Dist> = fc.oneof(
  fc.record({
    kind: fc.constant("const" as const),
    value: fc.double({ min: 0, max: 500, noNaN: true }),
  }),
  fc.record({
    kind: fc.constant("exp" as const),
    mean: fc.double({ min: 0.1, max: 500, noNaN: true }),
  }),
  fc.record({
    kind: fc.constant("lognormal" as const),
    mean: fc.double({ min: 0.1, max: 500, noNaN: true }),
    cv: fc.double({ min: 0.05, max: 2, noNaN: true }),
  }),
);

/** The mean of a distribution, by averaging its quantile function over an even grid. */
function numericMean(dist: Dist, points = 400_000): number {
  let total = 0;
  for (let i = 0; i < points; i++) total += quantile(dist, (i + 0.5) / points);
  return total / points;
}

describe("normal distribution", () => {
  it("matches table values", () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232, 5);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1.96)).toBeCloseTo(0.024998, 5);
  });

  it("has a quantile function that undoes the distribution function", () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-6, max: 1 - 1e-6, noNaN: true }), (p) => {
        expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 6);
      }),
    );
  });

  it("rejects probabilities outside 0 to 1", () => {
    expect(() => normalQuantile(-0.1)).toThrow(RangeError);
    expect(() => normalQuantile(Number.NaN)).toThrow(RangeError);
    expect(normalQuantile(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(normalQuantile(1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("quantile functions", () => {
  it("never give a smaller value for a larger draw, and never a negative or infinite one", () => {
    fc.assert(
      fc.property(
        anyDist,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (dist, a, b) => {
          const low = quantile(dist, Math.min(a, b));
          const high = quantile(dist, Math.max(a, b));
          expect(low).toBeLessThanOrEqual(high);
          expect(low).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(high)).toBe(true);
        },
      ),
    );
  });

  it("have the mean they are described by", () => {
    expect(numericMean({ kind: "exp", mean: 30 })).toBeCloseTo(30, 1);
    expect(numericMean({ kind: "lognormal", mean: 24, cv: 0.5 })).toBeCloseTo(24, 1);
    expect(numericMean({ kind: "const", value: 7 })).toBe(7);
  });

  it("have the spread they are described by", () => {
    const dist: Dist = { kind: "lognormal", mean: 100, cv: 0.5 };
    const points = 400_000;
    let squares = 0;
    for (let i = 0; i < points; i++) squares += (quantile(dist, (i + 0.5) / points) - 100) ** 2;
    expect(Math.sqrt(squares / points) / 100).toBeCloseTo(0.5, 2);
    expect(cvOf(dist)).toBe(0.5);
    expect(cvOf({ kind: "exp", mean: 3 })).toBe(1);
    expect(cvOf({ kind: "const", value: 3 })).toBe(0);
  });

  it("put the median of an exponential at mean times ln 2", () => {
    expect(medianOf({ kind: "exp", mean: 10 })).toBeCloseTo(10 * Math.LN2, 9);
  });
});

describe("a lognormal described by its median", () => {
  it("has that median, and the mean that goes with its spread", () => {
    const dist = lognormalFromMedian(2880, 1);
    expect(medianOf(dist)).toBeCloseTo(2880, 4);
    expect(meanOf(dist)).toBeCloseTo(2880 * Math.exp(0.5), 6);
  });

  it("puts half below the median and the textbook share within one sigma", () => {
    expect(lognormalShareBelow(100, 100, 0.8)).toBeCloseTo(0.5, 6);
    expect(lognormalShareBelow(100 * Math.exp(0.8), 100, 0.8)).toBeCloseTo(0.841345, 5);
    expect(lognormalShareBelow(0, 100, 0.8)).toBe(0);
  });

  it("agrees with its own quantile function", () => {
    const dist = lognormalFromMedian(48, 1);
    for (const u of [0.1, 0.22, 0.5, 0.9]) {
      expect(lognormalShareBelow(quantile(dist, u), 48, 1)).toBeCloseTo(u, 5);
    }
  });
});
