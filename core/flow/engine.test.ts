import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ALWAYS, type Calendar, CLOSE, DAY, OFFICE, OPEN, WORK_DAY } from "./calendar";
import { BASE, resolve, TODAY, withLever } from "./company";
import {
  FlowSim,
  type Item,
  type ProcessSpec,
  type Request,
  type SimEventKind,
  type StationSpec,
} from "./engine";
import { demandFor } from "./requests";

const station = (over: Partial<StationSpec> = {}): StationSpec => ({
  id: "desk",
  servers: 1,
  touch: { kind: "const", value: 6 },
  stretch: 1,
  releaseAt: [],
  patience: null,
  bypass: 0,
  rework: 0,
  reworkDelay: 0,
  ...over,
});

const line = (...stations: StationSpec[]): ProcessSpec => ({ stations, payment: null });

/** A request that stays to the end of a process with `stations` stations. */
const request = (id: number, at: number, stations = 1, over: Partial<Request> = {}): Request => ({
  id,
  at,
  value: 100,
  exitAfter: stations,
  key: id * 7919 + 13,
  label: `r${id}`,
  size: 1,
  ...over,
});

interface Logged {
  kind: SimEventKind;
  id: number;
  station: number;
  wall: number;
}

function run(
  process: ProcessSpec,
  requests: readonly Request[],
  until: number,
  calendar: Calendar = ALWAYS,
): { log: Logged[]; sim: FlowSim } {
  const sim = new FlowSim(
    process,
    (day) => requests.filter((r) => Math.floor(r.at / DAY) === day),
    calendar,
  );
  const log: Logged[] = [];
  sim.on((kind, item, at, flow) =>
    log.push({ kind, id: item.req.id, station: at, wall: flow.wall }),
  );
  sim.advanceTo(until);
  return { log, sim };
}

const of = (log: readonly Logged[], id: number) =>
  log.filter((entry) => entry.id === id).map((entry) => `${entry.kind}@${entry.wall}`);
const times = (log: readonly Logged[], kind: SimEventKind) =>
  log.filter((entry) => entry.kind === kind).map((entry) => entry.wall);

describe("one desk, no surprises", () => {
  it("serves each request on arrival when work comes slower than it is done", () => {
    const requests = [0, 10, 20, 30].map((at, id) => request(id, at));
    const { log, sim } = run(line(station()), requests, 100);
    expect(of(log, 0)).toEqual(["arrive@0", "start@0", "done@6", "billed@6", "paid@6"]);
    expect(times(log, "start")).toEqual([0, 10, 20, 30]);
    expect(sim.items.size).toBe(0);
  });

  it("makes each request wait one minute longer when work comes faster than it is done", () => {
    const requests = [0, 5, 10, 15, 20].map((at, id) => request(id, at));
    const { log } = run(line(station()), requests, 100);
    expect(times(log, "start")).toEqual([0, 6, 12, 18, 24]);
  });

  it("serves in the order requests arrived", () => {
    const requests = [0, 1, 2, 3].map((at, id) => request(id, at));
    const { log } = run(line(station({ touch: { kind: "const", value: 10 } })), requests, 100);
    expect(log.filter((entry) => entry.kind === "start").map((entry) => entry.id)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("stretches the work over the day when the team gives it only part of its time", () => {
    const { log } = run(
      line(station({ touch: { kind: "const", value: 10 }, stretch: 3 })),
      [request(0, 0)],
      100,
    );
    expect(of(log, 0)).toContain("done@30");
  });

  it("puts several people on several requests at once, each at their own seat", () => {
    const requests = [0, 0, 0].map((at, id) => request(id, at));
    const seats: number[] = [];
    const sim = new FlowSim(
      line(station({ servers: 2, touch: { kind: "const", value: 10 } })),
      (day) => (day === 0 ? requests : []),
      ALWAYS,
    );
    const starts: number[] = [];
    sim.on((kind, item, _at, flow) => {
      if (kind !== "start") return;
      starts.push(flow.wall);
      seats.push(item.server);
    });
    sim.advanceTo(100);
    expect(starts).toEqual([0, 0, 10]);
    expect(seats).toEqual([0, 1, 0]);
  });
});

describe("patience", () => {
  const impatient = station({
    touch: { kind: "const", value: 10 },
    patience: { kind: "const", value: 4 },
  });

  it("loses a customer who waits longer than they are willing to", () => {
    const { log, sim } = run(line(impatient), [request(0, 0), request(1, 1)], 100);
    expect(of(log, 1)).toEqual(["arrive@1", "left@5"]);
    expect(of(log, 0)).toContain("paid@10");
    expect(sim.items.size).toBe(0);
  });

  it("keeps a customer whose turn comes in time, and forgets their deadline once work starts", () => {
    const { log } = run(line(impatient), [request(0, 0), request(1, 7)], 100);
    expect(of(log, 1)).toEqual(["arrive@7", "start@10", "done@20", "billed@20", "paid@20"]);
  });

  it("lets a customer go at the very minute a person frees up", () => {
    const { log } = run(line(impatient), [request(0, 0), request(1, 6)], 100);
    expect(of(log, 1)).toEqual(["arrive@6", "left@10"]);
  });
});

describe("hand-outs and office hours", () => {
  const MON = 0;
  const TUE = DAY;
  const SAT = 5 * DAY;
  const NEXT_MON = 7 * DAY;
  const morning = station({ releaseAt: [0] });

  it("holds requests until the next hand-out", () => {
    const { log } = run(line(morning), [request(0, MON + 10 * 60)], 3 * WORK_DAY, OFFICE);
    expect(of(log, 0).slice(0, 3)).toEqual([
      `arrive@${MON + 10 * 60}`,
      `release@${TUE + OPEN}`,
      `start@${TUE + OPEN}`,
    ]);
  });

  it("hands out at opening what arrived overnight and over the weekend", () => {
    const requests = [
      request(0, MON + CLOSE + 45),
      request(1, SAT + 11 * 60),
      request(2, NEXT_MON + 7 * 60),
    ];
    const { log } = run(line(morning), requests, 8 * WORK_DAY, OFFICE);
    expect(of(log, 0)[1]).toBe(`release@${TUE + OPEN}`);
    expect(of(log, 1)[1]).toBe(`release@${NEXT_MON + OPEN}`);
    expect(of(log, 2)[1]).toBe(`release@${NEXT_MON + OPEN}`);
  });

  it("starts work at opening on what arrived while the office was closed", () => {
    const { log } = run(line(station()), [request(0, SAT + 11 * 60)], 8 * WORK_DAY, OFFICE);
    expect(of(log, 0)).toEqual([
      `arrive@${NEXT_MON + OPEN}`,
      `start@${NEXT_MON + OPEN}`,
      `done@${NEXT_MON + OPEN + 6}`,
      `billed@${NEXT_MON + OPEN + 6}`,
      `paid@${NEXT_MON + OPEN + 6}`,
    ]);
  });

  it("counts a customer's patience through nights and weekends", () => {
    const friday = 4 * DAY + 17 * 60;
    const spec = station({ releaseAt: [0], patience: { kind: "const", value: 24 * 60 } });
    const { log } = run(line(spec), [request(0, friday)], 8 * WORK_DAY, OFFICE);
    // Gone on Saturday afternoon; the company finds out when it opens on Monday.
    expect(of(log, 0)).toEqual([`arrive@${friday}`, `left@${NEXT_MON + OPEN}`]);
  });

  it("can hand out several times a day", () => {
    const twice = station({ releaseAt: [0, 270] });
    const { log } = run(
      line(twice),
      [request(0, MON + 10 * 60), request(1, MON + 15 * 60)],
      3 * WORK_DAY,
      OFFICE,
    );
    expect(of(log, 0)[1]).toBe(`release@${MON + OPEN + 270}`);
    expect(of(log, 1)[1]).toBe(`release@${TUE + OPEN}`);
  });
});

describe("steps a request can skip, repeat or stop at", () => {
  it("passes requests that need no person straight through", () => {
    const { log } = run(line(station({ bypass: 1 })), [request(0, 3)], 50);
    expect(of(log, 0)).toEqual(["arrive@3", "auto@3", "billed@3", "paid@3"]);
  });

  it("brings rejected work back for a second pass after the delay", () => {
    const { log } = run(line(station({ rework: 1, reworkDelay: 20 })), [request(0, 0)], 100);
    expect(of(log, 0)).toEqual([
      "arrive@0",
      "start@0",
      "done@6",
      "redo@6",
      "return@26",
      "start@26",
      "done@32",
      "billed@32",
      "paid@32",
    ]);
  });

  it("lets a customer leave by choice after the step where they decide", () => {
    const two = line(station({ id: "a" }), station({ id: "b" }));
    const { log, sim } = run(two, [request(0, 0, 2, { exitAfter: 0 }), request(1, 1, 2)], 100);
    expect(of(log, 0)).toEqual(["arrive@0", "start@0", "done@6", "exit@6"]);
    expect(of(log, 1)).toEqual([
      "arrive@1",
      "start@6",
      "done@12",
      "enter@12",
      "start@12",
      "done@18",
      "billed@18",
      "paid@18",
    ]);
    expect(sim.items.size).toBe(0);
  });

  it("waits for the payment after the last step", () => {
    const process: ProcessSpec = { stations: [station()], payment: { kind: "const", value: 30 } };
    const { log } = run(process, [request(0, 0)], 100);
    expect(of(log, 0)).toEqual(["arrive@0", "start@0", "done@6", "billed@6", "paid@36"]);
  });
});

describe("changing the process while it runs", () => {
  it("hands out held requests at once when hand-outs stop", () => {
    const requests = [request(0, OPEN + 60), request(1, OPEN + 90)];
    const sim = new FlowSim(
      line(station({ releaseAt: [0] })),
      (day) => (day === 0 ? requests : []),
      OFFICE,
    );
    const log: Logged[] = [];
    sim.on((kind, item, at, flow) =>
      log.push({ kind, id: item.req.id, station: at, wall: flow.wall }),
    );
    sim.advanceTo(120);
    expect(sim.station(0).held).toHaveLength(2);
    sim.setProcess(line(station()));
    sim.advanceTo(200);
    expect(of(log, 0).slice(1, 3)).toEqual([`release@${OPEN + 120}`, `start@${OPEN + 120}`]);
    expect(of(log, 1)).toContain(`start@${OPEN + 126}`);
  });

  it("puts new people to work on whoever is waiting", () => {
    const requests = [0, 0, 0].map((at, id) => request(id, at));
    const slow = station({ touch: { kind: "const", value: 50 } });
    const sim = new FlowSim(line(slow), (day) => (day === 0 ? requests : []), ALWAYS);
    const starts: number[] = [];
    sim.on((kind, _item, _at, flow) => {
      if (kind === "start") starts.push(flow.wall);
    });
    sim.advanceTo(10);
    sim.setProcess(line({ ...slow, servers: 3 }));
    sim.advanceTo(200);
    expect(starts).toEqual([0, 10, 10]);
  });

  it("lets waiting requests skip a step that no longer needs a person", () => {
    const requests = [0, 0].map((at, id) => request(id, at));
    const slow = station({ touch: { kind: "const", value: 50 } });
    const sim = new FlowSim(line(slow), (day) => (day === 0 ? requests : []), ALWAYS);
    const log: Logged[] = [];
    sim.on((kind, item, at, flow) =>
      log.push({ kind, id: item.req.id, station: at, wall: flow.wall }),
    );
    sim.advanceTo(10);
    sim.setProcess(line({ ...slow, bypass: 1 }));
    sim.advanceTo(200);
    expect(of(log, 1)).toEqual(["arrive@0", "auto@10", "billed@10", "paid@10"]);
    expect(of(log, 0)).toContain("done@50");
  });

  it("refuses a process with a different number of steps", () => {
    const sim = new FlowSim(line(station()), () => [], ALWAYS);
    expect(() => sim.setProcess(line(station(), station()))).toThrow();
  });
});

describe("the whole company", () => {
  const quarter = 95 * WORK_DAY;

  function tally(process: ProcessSpec, seed: number) {
    const sim = new FlowSim(process, demandFor(seed), OFFICE);
    const counts: Partial<Record<SimEventKind, number>> = {};
    let last = 0;
    let backwards = 0;
    let crowded = 0;
    sim.on((kind, _item, at, flow) => {
      counts[kind] = (counts[kind] ?? 0) + 1;
      if (flow.now < last) backwards++;
      last = flow.now;
      const spec = process.stations[at];
      if (kind === "start" && spec && flow.station(at).active.length > spec.servers) crowded++;
    });
    sim.advanceTo(quarter);
    return { sim, counts, backwards, crowded };
  }

  it.each([
    ["today", TODAY],
    ["with requests assigned on arrival", withLever(TODAY, "routing", true)],
    ["with contracts approved by rule", withLever(TODAY, "autoApprove", true)],
  ])("accounts for every request, %s", (_name, setup) => {
    const { sim, counts, backwards, crowded } = tally(resolve(setup, BASE), 3);
    const arrived = counts.arrive ?? 0;
    const ended = (counts.paid ?? 0) + (counts.left ?? 0) + (counts.exit ?? 0);
    expect(arrived).toBeGreaterThan(1000);
    expect(arrived).toBe(ended + sim.items.size);
    expect(counts.done).toBe((counts.start ?? 0) - activeNow(sim));
    expect(backwards).toBe(0);
    expect(crowded).toBe(0);
  });

  it("repeats every event when run again on the same requests", () => {
    const record = () => {
      const sim = new FlowSim(resolve(TODAY, BASE), demandFor(5), OFFICE);
      const log: string[] = [];
      sim.on((kind, item, at, flow) => log.push(`${kind}:${item.req.id}:${at}:${flow.now}`));
      sim.advanceTo(20 * WORK_DAY);
      return log;
    };
    const first = record();
    expect(first.length).toBeGreaterThan(1000);
    expect(record()).toEqual(first);
  });

  it("gives the same history whether time advances in one step or in many", () => {
    const record = (step: number) => {
      const sim = new FlowSim(resolve(TODAY, BASE), demandFor(8), OFFICE);
      const log: string[] = [];
      sim.on((kind, item, at, flow) => log.push(`${kind}:${item.req.id}:${at}:${flow.now}`));
      for (let now = step; now <= 12 * WORK_DAY; now += step) sim.advanceTo(now);
      sim.advanceTo(12 * WORK_DAY);
      return log;
    };
    expect(record(7.3)).toEqual(record(12 * WORK_DAY));
  });
});

function activeNow(sim: FlowSim): number {
  let active = 0;
  for (const item of sim.items) if (item.status === "working") active++;
  return active;
}

describe("any process, any requests", () => {
  const anyStation = fc.record({
    servers: fc.integer({ min: 1, max: 3 }),
    touch: fc.oneof(
      fc.record({ kind: fc.constant("const" as const), value: fc.integer({ min: 1, max: 40 }) }),
      fc.record({ kind: fc.constant("exp" as const), mean: fc.integer({ min: 1, max: 40 }) }),
      fc.record({
        kind: fc.constant("lognormal" as const),
        mean: fc.integer({ min: 1, max: 40 }),
        cv: fc.constantFrom(0.3, 0.8),
      }),
    ),
    stretch: fc.constantFrom(1, 1.5, 3),
    releaseAt: fc.constantFrom<number[]>([], [0], [0, 270]),
    patience: fc.option(
      fc.record({ kind: fc.constant("exp" as const), mean: fc.integer({ min: 5, max: 3000 }) }),
      {
        nil: null,
      },
    ),
    bypass: fc.constantFrom(0, 0.5),
    rework: fc.constantFrom(0, 0.3),
    reworkDelay: fc.constantFrom(0, 600),
  });
  const anyRun = fc.record({
    stations: fc.array(anyStation, { minLength: 1, maxLength: 3 }),
    arrivals: fc.array(fc.integer({ min: 0, max: 6 * DAY }), { minLength: 1, maxLength: 80 }),
    office: fc.boolean(),
    seed: fc.integer({ min: 0, max: 1_000_000 }),
  });

  it("never loses or invents a request, never overbooks a team, never runs time backwards", () => {
    fc.assert(
      fc.property(anyRun, ({ stations, arrivals, office, seed }) => {
        const process: ProcessSpec = {
          stations: stations.map((spec, index) => ({ ...spec, id: `s${index}` })),
          payment: { kind: "exp", mean: 200 },
        };
        const requests = arrivals.map((at, id) =>
          request(id, at, stations.length, {
            key: seed + id * 104729,
            exitAfter: id % 4 === 0 ? id % stations.length : stations.length,
          }),
        );
        const sim = new FlowSim(
          process,
          (day) => requests.filter((r) => Math.floor(r.at / DAY) === day),
          office ? OFFICE : ALWAYS,
        );
        const fate = new Map<number, SimEventKind>();
        const working = new Set<Item>();
        let last = 0;
        sim.on((kind, item, at, flow) => {
          expect(flow.now).toBeGreaterThanOrEqual(last);
          last = flow.now;
          if (kind === "start") {
            expect(working.has(item)).toBe(false);
            working.add(item);
            const active = flow.station(at).active;
            expect(active.length).toBeLessThanOrEqual(process.stations[at]?.servers ?? 0);
            expect(new Set(active.map((other) => other.server)).size).toBe(active.length);
            expect(item.ends).toBeGreaterThan(item.started);
          }
          if (kind === "done") expect(working.delete(item)).toBe(true);
          if (kind === "paid" || kind === "left" || kind === "exit") {
            expect(fate.has(item.req.id)).toBe(false);
            fate.set(item.req.id, kind);
            expect(working.has(item)).toBe(false);
          }
        });
        // Long enough for every wait, rework and payment to play out.
        sim.advanceTo(400 * WORK_DAY);
        expect(fate.size + sim.items.size).toBe(requests.length);
        for (const item of sim.items) {
          // Whoever is still here is waiting on a team with no deadline, never mid-air.
          expect(["held", "queued", "working", "redo", "paying"]).toContain(item.status);
        }
        for (let index = 0; index < process.stations.length; index++) {
          const { held, queue, active } = sim.station(index);
          for (const item of held) expect(item.status).toBe("held");
          for (const item of queue) expect(item.status).toBe("queued");
          for (const item of active) expect(item.status).toBe("working");
        }
      }),
      { numRuns: 150 },
    );
  });
});
