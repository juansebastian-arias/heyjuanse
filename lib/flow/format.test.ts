import { describe, expect, it } from "vitest";
import {
  count,
  days,
  duration,
  hoursPerDay,
  money,
  payback,
  percent,
  plural,
  signedCount,
  signedMoney,
} from "./format";

describe("money", () => {
  it.each([
    [0, "$0"],
    [612.4, "$612"],
    [999, "$999"],
    [1000, "$1k"],
    [2500, "$2.5k"],
    [9949, "$9.9k"],
    [9950, "$10k"],
    [350_227, "$350k"],
    [999_499, "$999k"],
    [999_500, "$1.0M"],
    [1_240_000, "$1.2M"],
    [12_400_000, "$12M"],
    [-3200, "−$3.2k"],
  ])("writes %d as %s", (value, text) => {
    expect(money(value)).toBe(text);
  });

  it("never rounds a figure up into the next unit's notation", () => {
    // "$1000k" and "$10.0k" would be the same amounts written worse.
    for (let value = 0; value < 2_000_000; value += 137) {
      const text = money(value);
      expect(text).not.toMatch(/\$1000k|\$\d{2,}\.\dk|\.0k/);
    }
  });

  it("puts a sign on a change and none on zero", () => {
    expect(signedMoney(39_900)).toBe("+$40k");
    expect(signedMoney(-612)).toBe("−$612");
    expect(signedMoney(0.2)).toBe("$0");
    expect(signedMoney(-0.2)).toBe("$0");
  });

  it("shows a dash for a figure it was not given", () => {
    expect(money(Number.NaN)).toBe("–");
    expect(signedMoney(Number.POSITIVE_INFINITY)).toBe("–");
  });
});

describe("counts", () => {
  it.each([
    [0, "0"],
    [0.04, "0"],
    [0.7, "0.7"],
    [1, "1"],
    [6.24, "6.2"],
    [9.94, "9.9"],
    [9.96, "10"],
    [21.8, "22"],
    [1234.4, "1,234"],
  ])("writes %d as %s", (value, text) => {
    expect(count(value)).toBe(text);
  });

  it("signs a change, and calls a change too small to show zero", () => {
    expect(signedCount(-6.2)).toBe("−6.2");
    expect(signedCount(3)).toBe("+3");
    expect(signedCount(-0.01)).toBe("0");
  });

  it("uses the singular only for one", () => {
    expect(plural(1, "person", "people")).toBe("person");
    expect(plural(0, "person", "people")).toBe("people");
    expect(plural(4, "person", "people")).toBe("people");
  });
});

describe("time", () => {
  it.each([
    [0, "0 min"],
    [0.05, "3 min"],
    [0.5, "30 min"],
    [0.99, "59 min"],
    [1, "1 h"],
    [3.74, "3.7 h"],
    [9.96, "10 h"],
    [24.1, "24 h"],
    [47.4, "47 h"],
    [48, "2 days"],
    [583, "24.3 days"],
  ])("writes %d hours as %s", (hours, text) => {
    expect(duration(hours)).toBe(text);
  });

  it("never writes sixty minutes or more as minutes", () => {
    for (let hours = 0; hours < 3; hours += 0.001) {
      const text = duration(hours);
      const minutes = /^(\d+) min$/.exec(text);
      if (minutes) expect(Number(minutes[1])).toBeLessThan(60);
    }
  });

  it("writes days with one decimal below ten", () => {
    expect(days(1)).toBe("1 day");
    expect(days(14.7)).toBe("15 days");
    expect(days(2.74)).toBe("2.7 days");
    expect(days(19.6)).toBe("20 days");
  });

  it("writes hours of work a day", () => {
    expect(hoursPerDay(6)).toBe("6 h");
    expect(hoursPerDay(1.5)).toBe("1.5 h");
    expect(hoursPerDay(26.2)).toBe("26 h");
  });

  it("writes shares as whole percentages", () => {
    expect(percent(0.874)).toBe("87%");
    expect(percent(1.09)).toBe("109%");
  });

  it("keeps payback coarse: the model does not simulate a change bedding in", () => {
    expect(payback(0.08)).toBe("within a month");
    expect(payback(1.2)).toBe("in about a month");
    expect(payback(1.6)).toBe("in about 2 months");
    expect(payback(7.4)).toBe("in about 7 months");
  });
});
