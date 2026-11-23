import { describe, expect, it } from "vitest";
import { createRng } from "../random";
import { chance, keyOf } from "./chance";

const SAMPLES = 200_000;

/** Chi-square statistic of values in [0, 1) against an even spread over `bins` bins. */
function chiSquare(values: readonly number[], bins: number): number {
  const counts = new Array<number>(bins).fill(0);
  for (const value of values)
    counts[Math.floor(value * bins)] = (counts[Math.floor(value * bins)] ?? 0) + 1;
  const expected = values.length / bins;
  return counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
}

function correlation(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  const mean = (list: readonly number[]) => list.reduce((sum, value) => sum + value, 0) / n;
  const mx = mean(xs);
  const my = mean(ys);
  let xy = 0;
  let xx = 0;
  let yy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    xy += dx * dy;
    xx += dx * dx;
    yy += dy * dy;
  }
  return xy / Math.sqrt(xx * yy);
}

const randomKeys = (() => {
  const rng = createRng(99);
  return Array.from({ length: SAMPLES }, () => Math.floor(rng.next() * 4294967296));
})();
const countingKeys = Array.from({ length: SAMPLES }, (_, index) => index);

/** 99.9th percentile of chi-square with 19 degrees of freedom. */
const CHI_19 = 43.82;
/** Five standard errors of a correlation between independent samples of this size. */
const NO_CORRELATION = 5 / Math.sqrt(SAMPLES);

describe("chance", () => {
  it("always gives the same answer to the same question about the same request", () => {
    expect(chance(123456, 7)).toBe(chance(123456, 7));
    expect(chance(123456, 7)).not.toBe(chance(123456, 8));
    expect(chance(123456, 7)).not.toBe(chance(123457, 7));
  });

  it("stays inside 0 to 1", () => {
    for (const key of [0, 1, 2 ** 31, 2 ** 32 - 1, -5, 3.7]) {
      for (let question = 0; question < 40; question++) {
        const value = chance(key, question);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it.each([
    ["random keys", randomKeys],
    ["keys that count up from zero", countingKeys],
  ])("spreads answers evenly, for %s", (_name, keys) => {
    for (const question of [0, 1, 2, 12, 24, 1000, 1005]) {
      expect(
        chiSquare(
          keys.map((key) => chance(key, question)),
          20,
        ),
      ).toBeLessThan(CHI_19);
    }
  });

  it("gives unrelated answers to different questions about the same request", () => {
    const answers = (question: number) => countingKeys.map((key) => chance(key, question));
    const pairs: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [2, 3],
      [4, 5],
      [3, 1000],
      [24, 1004],
    ];
    for (const [a, b] of pairs) {
      expect(Math.abs(correlation(answers(a), answers(b)))).toBeLessThan(NO_CORRELATION);
    }
  });

  it("gives unrelated answers to the same question about neighboring requests", () => {
    const answers = countingKeys.map((key) => chance(key, 2));
    expect(Math.abs(correlation(answers.slice(0, -1), answers.slice(1)))).toBeLessThan(
      NO_CORRELATION,
    );
  });

  it("derives keys that almost never collide", () => {
    const keys = new Set<number>();
    for (let group = 0; group < 200; group++) {
      for (let index = 0; index < 500; index++) keys.add(keyOf(group, index));
    }
    // 100,000 draws from 2^32 values collide about once by chance alone.
    expect(keys.size).toBeGreaterThan(99_990);
  });
});
