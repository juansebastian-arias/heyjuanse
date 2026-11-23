import { describe, expect, it } from "vitest";
import { STATION_IDS, TODAY, withLever } from "./company";
import { type Cause, causeOf, type Reading, readAll, readStation, worstLoss } from "./diagnose";
import { demands, project, runMany } from "./experiment";

const reading = (over: Partial<Reading>): Omit<Reading, "cause"> => ({
  station: "reply",
  waitHours: 0,
  closedHours: 0,
  assignHours: 0,
  lineHours: 0,
  loadHours: 4,
  capacityHours: 8,
  busyShare: 0.5,
  lostBuyers: 0,
  lostValue: 0,
  redoShare: 0,
  autoShare: 0,
  ...over,
});

describe("why a team has a line", () => {
  const cases: Array<[string, Partial<Reading>, Cause]> = [
    ["work waits to be handed out", { assignHours: 16, closedHours: 4, lineHours: 3 }, "handout"],
    ["more work than hours", { loadHours: 26, capacityHours: 24, lineHours: 40 }, "overload"],
    ["work equal to hours", { loadHours: 6, capacityHours: 6, lineHours: 5 }, "overload"],
    ["little slack and a line", { loadHours: 21, capacityHours: 24, lineHours: 10 }, "tight"],
    ["little slack but no line", { loadHours: 21, capacityHours: 24, lineHours: 0.2 }, "clear"],
    [
      "nights and weekends",
      { closedHours: 4, lineHours: 1, loadHours: 2, capacityHours: 6 },
      "hours",
    ],
    ["nothing to see", { closedHours: 0.3, lineHours: 0.2 }, "clear"],
    ["hand-out too short to matter", { assignHours: 0.5, lineHours: 0.1 }, "clear"],
  ];
  it.each(cases)("%s", (_name, values, expected) => {
    expect(causeOf(reading(values))).toBe(expected);
  });
});

describe("reading Larkspur", () => {
  const streams = demands(16);
  const today = project(runMany(TODAY, streams));
  const routed = project(runMany(withLever(TODAY, "routing", true), streams));

  it("reads every team", () => {
    expect(readAll(today).map((r) => r.station)).toEqual([...STATION_IDS]);
  });

  it("finds that today's wait for a reply is a wait to be assigned", () => {
    const reply = readStation(today, "reply");
    expect(reply.cause).toBe("handout");
    expect(reply.assignHours).toBeGreaterThan(reply.lineHours);
    expect(reply.waitHours).toBeCloseTo(reply.closedHours + reply.assignHours + reply.lineHours, 6);
    expect(worstLoss(readAll(today))?.station).toBe("reply");
  });

  it("finds the account executives overloaded once requests are assigned on arrival", () => {
    expect(readStation(routed, "reply").cause).not.toBe("handout");
    expect(readStation(routed, "reply").assignHours).toBe(0);
    const quote = readStation(routed, "quote");
    expect(quote.cause).toBe("overload");
    expect(quote.loadHours).toBeGreaterThan(quote.capacityHours);
    expect(quote.lostBuyers).toBeGreaterThan(readStation(today, "quote").lostBuyers);
  });

  it("reports no worst team when nobody is lost", () => {
    expect(worstLoss(readAll(today).map((r) => ({ ...r, lostBuyers: 0.1 })))).toBeNull();
  });
});
