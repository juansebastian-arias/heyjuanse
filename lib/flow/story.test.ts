import { describe, expect, it } from "vitest";
import { STATION_IDS, TODAY, withLever } from "@/core/flow/company";
import { compareBuyers, type Trace } from "@/core/flow/trace";
import { duration, money } from "./format";
import { MOMENTS, momentText, storyOf } from "./story";

const EVERYTHING = (
  ["routing", "replyDrafts", "quoteDrafts", "autoApprove", "selfServe", "billingSync"] as const
).reduce((setup, id) => withLever(setup, id, true), TODAY);

// Three weeks of would-be buyers, as the company runs today and with every improvement on.
const pairs = compareBuyers(TODAY, EVERYTHING, 56, 77, 3);
const traces: Trace[] = pairs.flatMap((pair) => [pair.before, pair.after]);

describe("a customer's story", () => {
  it("has traces of every ending to work with", () => {
    expect(pairs.length).toBeGreaterThan(30);
    expect(traces.some((trace) => trace.fate === "paid")).toBe(true);
    expect(traces.some((trace) => trace.fate === "left")).toBe(true);
  });

  it("starts when the customer wrote in", () => {
    for (const trace of traces) {
      expect(storyOf(trace).moments[0]?.wall).toBe(trace.request.at);
    }
  });

  it("tells the moments in the order they happened", () => {
    for (const trace of traces) {
      const times = storyOf(trace)
        .moments.map((moment) => moment.wall)
        .filter((wall) => wall !== null);
      expect(times).toEqual([...times].sort((x, y) => x - y));
    }
  });

  it("gives a customer who paid every moment, and ends on the payment", () => {
    for (const trace of traces.filter((item) => item.fate === "paid")) {
      const story = storyOf(trace);
      expect(story.moments).toHaveLength(MOMENTS.length);
      for (const moment of story.moments) {
        expect(moment.wall).not.toBeNull();
        expect(moment.gaveUp).toBe(false);
      }
      const paidAt = story.moments[MOMENTS.length - 1]?.wall ?? 0;
      expect(paidAt - trace.request.at).toBeCloseTo(trace.minutes, 6);
      expect(story.ending).toBe(
        `Paid ${money(trace.request.value)}, ${duration(trace.minutes / 60)} after writing in.`,
      );
    }
  });

  it("stops a customer who gave up at the step they were waiting for", () => {
    for (const trace of traces.filter((item) => item.fate === "left")) {
      const story = storyOf(trace);
      const gaveUp = story.moments.findIndex((moment) => moment.gaveUp);
      // Moment 1 is the first team's, so the team at index n owns moment n + 1.
      expect(gaveUp).toBe(trace.station + 1);
      expect(story.moments.filter((moment) => moment.gaveUp)).toHaveLength(1);
      for (const moment of story.moments.slice(gaveUp + 1)) expect(moment.wall).toBeNull();
      for (const moment of story.moments.slice(0, gaveUp + 1)) expect(moment.wall).not.toBeNull();
      expect(story.ending).toContain("Gave up after");
      expect(story.ending).toContain(`${money(trace.request.value)} not sold`);
    }
  });

  it("only ever follows customers who would have bought", () => {
    for (const trace of traces) expect(trace.request.exitAfter).toBe(STATION_IDS.length);
    // So nobody in these stories leaves by choice: they pay, give up, or are still on their way.
    for (const trace of traces) expect(trace.fate).not.toBe("exit");
  });

  it("notes a contract approved by rule, and an invoice that had to be redone", () => {
    const notes = traces.flatMap((trace) =>
      storyOf(trace)
        .moments.map((moment) => moment.note)
        .filter((note) => note !== null),
    );
    expect(notes).toContain("approved by rule, no wait");
    expect(notes).toContain("after the first one was disputed and redone");
  });

  it("writes a moment as a clock time and how long after the request it came", () => {
    const at = 7 * 24 * 60 + 10 * 60 + 53;
    expect(momentText({ wall: at, note: null, gaveUp: false }, at)).toBe("Mon 10:53");
    expect(momentText({ wall: at + 119, note: null, gaveUp: false }, at)).toBe("Mon 12:52, 2 h in");
    expect(momentText({ wall: null, note: null, gaveUp: false }, at)).toBe("–");
  });
});
