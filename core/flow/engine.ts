/**
 * A discrete-event simulation of work moving through a line of teams.
 *
 * Nothing here knows about any particular company. A process is a list of stations; each has
 * people, a time per item and rules for who goes next. What luck decides about a request is a
 * fixed function of the request (see `chance`), so the engine draws no random numbers: run it
 * twice on the same requests and the same process and every event repeats, to the minute. Change
 * the process and the only differences are the ones the change caused.
 *
 * Time moves from event to event, never in fixed steps, so a quiet night costs nothing to
 * simulate and a reply that takes four minutes is not rounded to a day.
 */
import { type Calendar, OFFICE } from "./calendar";
import { chance } from "./chance";
import { type Dist, quantile } from "./dist";
import { Heap } from "./heap";

/** One step of the process, as the engine sees it. */
export interface StationSpec {
  id: string;
  /** People who each handle one item at a time. */
  servers: number;
  /** Hands-on minutes one item takes. */
  touch: Dist;
  /**
   * Working minutes that pass per hands-on minute. A team that gives this work three hours of a
   * nine-hour day has a stretch of 3: a one-hour job is done three working hours after it starts.
   */
  stretch: number;
  /** Minutes after opening at which waiting items are handed out. Empty: the moment they arrive. */
  releaseAt: readonly number[];
  /** How long a customer waits here before leaving, in calendar minutes. Null: as long as it takes. */
  patience: Dist | null;
  /** Share of items that need no person at this step. */
  bypass: number;
  /** Share of items that come back for a second pass, and after how many calendar minutes. */
  rework: number;
  reworkDelay: number;
}

export interface ProcessSpec {
  stations: readonly StationSpec[];
  /** Calendar minutes from the last step to the money arriving. Null: at once. */
  payment: Dist | null;
}

/**
 * The questions the engine asks about a request at each station: how long the first pass takes,
 * how long a second pass takes, how long the customer will wait, whether the step needs a person
 * and whether the work comes back.
 */
export const QUESTIONS_PER_STATION = 5;
const Q_PASS = 0;
const Q_PATIENCE = 2;
const Q_BYPASS = 3;
const Q_REWORK = 4;
/** How long the customer takes to pay. Question numbers from here up are free for callers. */
const Q_PAYMENT = 1000;
export const FIRST_FREE_QUESTION = 1001;

/** A customer request. */
export interface Request {
  id: number;
  /** Calendar minute it was sent. */
  at: number;
  /** What it is worth if it goes all the way. */
  value: number;
  /**
   * Index of the station after which this customer leaves by their own choice, however fast they
   * were served. Equal to the number of stations for a customer who stays to the end.
   */
  exitAfter: number;
  /** Decides everything luck decides about this request. See `chance`. */
  key: number;
  label: string;
  /** A size for display, such as the customer's fleet. */
  size: number;
}

export type ItemStatus =
  /** Arrived, not yet handed to anyone. */
  | "held"
  | "queued"
  | "working"
  /** Sent back, waiting to return for a second pass. */
  | "redo"
  /** Past the last station, waiting for the payment to arrive. */
  | "paying";

/** A request on its way through the process. */
export interface Item {
  req: Request;
  station: number;
  status: ItemStatus;
  pass: 0 | 1;
  /** Calendar minute it entered the current station. */
  entered: number;
  /** Calendar minute it became workable at the current station. */
  released: number;
  /** Working minute at which the customer gives up waiting here. Infinity: never. */
  deadline: number;
  /** Working minutes at which the current handling started and ends. */
  started: number;
  ends: number;
  /** Which person at the station is handling it. */
  server: number;
  /** Bumped whenever the item moves on, so an old "gives up" event cannot fire late. */
  epoch: number;
}

export type SimEventKind =
  /** Entered the first station. */
  | "arrive"
  /** Entered a later station. */
  | "enter"
  /** Handed to the team after being held. */
  | "release"
  | "start"
  | "done"
  /** Passed the station without a person. */
  | "auto"
  /** Gave up waiting. */
  | "left"
  /** Left by choice after a step. */
  | "exit"
  /** Sent back for a second pass. */
  | "redo"
  /** Came back for the second pass. */
  | "return"
  /** Finished the last station; payment pending. */
  | "billed"
  | "paid";

export type Listener = (kind: SimEventKind, item: Item, station: number, sim: FlowSim) => void;

const DAY_STARTS = 0;
const ARRIVE = 1;
const LEAVE = 2;
const RETURN = 3;
const RELEASE = 4;
const DONE = 5;
const PAID = 6;
const DISPATCH = 7;

/**
 * One entry on the agenda. `kind` doubles as the order of events that fall on the same minute:
 * a customer who ran out of patience overnight is gone before the morning's work is handed out,
 * and work only starts once everything else that happens at that minute has happened.
 */
interface Scheduled {
  work: number;
  kind: number;
  seq: number;
  item: Item | null;
  req: Request | null;
  /** A station index, a day index or an item's epoch, depending on the kind. */
  a: number;
  /** The release version, for releases. */
  b: number;
}

interface StationState {
  held: Item[];
  queue: Item[];
  active: Item[];
  dispatchPending: boolean;
  releaseVersion: number;
}

/** The shortest handling the engine allows, so nothing takes zero time. */
const MIN_HANDLING = 0.5;

export class FlowSim {
  /** Working minutes since the start. */
  now = 0;
  /** Every request currently somewhere in the process. */
  readonly items = new Set<Item>();
  process: ProcessSpec;

  private readonly agenda = new Heap<Scheduled>(
    (a, b) =>
      a.work < b.work ||
      (a.work === b.work && (a.kind < b.kind || (a.kind === b.kind && a.seq < b.seq))),
  );
  private readonly state: StationState[];
  private seq = 0;
  private pulledDay = -1;
  private readonly listeners: Listener[] = [];

  constructor(
    process: ProcessSpec,
    /** The requests sent on a calendar day, in any order. */
    private readonly demand: (calendarDay: number) => readonly Request[],
    readonly calendar: Calendar = OFFICE,
  ) {
    this.process = process;
    this.state = process.stations.map(() => ({
      held: [],
      queue: [],
      active: [],
      dispatchPending: false,
      releaseVersion: 0,
    }));
    this.schedule(0, DAY_STARTS, null, null, 0);
  }

  on(listener: Listener): void {
    this.listeners.push(listener);
  }

  /** The calendar minute of the current instant. */
  get wall(): number {
    return this.calendar.wallOfWork(this.now);
  }

  /** Items at a station: not yet handed out, waiting in line, and being handled. */
  station(
    index: number,
  ): Readonly<{ held: readonly Item[]; queue: readonly Item[]; active: readonly Item[] }> {
    return this.at(index);
  }

  /** Run every event up to and including working minute `work`. */
  advanceTo(work: number): void {
    for (let next = this.agenda.peek(); next && next.work <= work; next = this.agenda.peek()) {
      this.agenda.pop();
      this.now = next.work;
      this.handle(next);
    }
    if (work > this.now) this.now = work;
  }

  /**
   * Change how the process works from this moment on. Work already started finishes as it began;
   * everything waiting, and everything that arrives later, follows the new rules.
   */
  setProcess(next: ProcessSpec): void {
    if (next.stations.length !== this.process.stations.length) {
      throw new Error("A process cannot change its number of stations while it runs");
    }
    const previous = this.process;
    this.process = next;
    next.stations.forEach((spec, index) => {
      const state = this.at(index);
      const before = previous.stations[index];
      const sameReleases =
        before !== undefined &&
        before.releaseAt.length === spec.releaseAt.length &&
        before.releaseAt.every((minute, i) => minute === spec.releaseAt[i]);
      if (!sameReleases) {
        // Releases already on the agenda belong to the old rules.
        state.releaseVersion++;
        if (spec.releaseAt.length === 0) this.release(index);
        else this.scheduleReleases(index, Math.floor(this.now / this.calendar.day));
      }
      if (spec.bypass > (before?.bypass ?? 0)) {
        for (const item of [...state.held, ...state.queue]) {
          if (item.pass === 0 && this.ask(item, Q_BYPASS) < spec.bypass) {
            remove(state.held, item);
            remove(state.queue, item);
            item.epoch++;
            this.emit("auto", item, index);
            this.advance(item, index);
          }
        }
      }
      this.requestDispatch(index);
    });
  }

  private at(index: number): StationState {
    const state = this.state[index];
    if (!state) throw new RangeError(`No station ${index}`);
    return state;
  }

  private spec(index: number): StationSpec {
    const spec = this.process.stations[index];
    if (!spec) throw new RangeError(`No station ${index}`);
    return spec;
  }

  /** The answer to one of the engine's questions about an item at its current station. */
  private ask(item: Item, question: number): number {
    return chance(item.req.key, item.station * QUESTIONS_PER_STATION + question);
  }

  private schedule(
    work: number,
    kind: number,
    item: Item | null,
    req: Request | null,
    a: number,
    b = 0,
  ): void {
    this.agenda.push({ work: Math.max(work, this.now), kind, seq: this.seq++, item, req, a, b });
  }

  private emit(kind: SimEventKind, item: Item, station: number): void {
    for (const listener of this.listeners) listener(kind, item, station, this);
  }

  private requestDispatch(station: number): void {
    const state = this.at(station);
    if (state.dispatchPending) return;
    state.dispatchPending = true;
    this.schedule(this.now, DISPATCH, null, null, station);
  }

  private scheduleReleases(station: number, dayIndex: number): void {
    const state = this.at(station);
    for (const minute of this.spec(station).releaseAt) {
      const work = dayIndex * this.calendar.day + minute;
      if (work >= this.now) {
        this.schedule(work, RELEASE, null, null, station, state.releaseVersion);
      }
    }
  }

  private handle(event: Scheduled): void {
    const { item } = event;
    switch (event.kind) {
      case DAY_STARTS:
        this.startDay(event.a);
        return;
      case ARRIVE:
        if (event.req) this.arrive(event.req);
        return;
      case LEAVE:
        if (item) this.leave(item, event.a);
        return;
      case RETURN:
        if (item) this.comeBack(item);
        return;
      case RELEASE:
        if (event.b === this.at(event.a).releaseVersion) this.release(event.a);
        return;
      case DONE:
        if (item) this.done(item);
        return;
      case PAID:
        if (!item) return;
        this.items.delete(item);
        this.emit("paid", item, this.process.stations.length);
        return;
      case DISPATCH:
        this.dispatch(event.a);
        return;
    }
  }

  private startDay(index: number): void {
    const today = this.calendar.calendarDay(index);
    for (let day = this.pulledDay + 1; day <= today; day++) {
      for (const req of this.demand(day)) {
        this.schedule(this.calendar.workOfWall(req.at), ARRIVE, null, req, 0);
      }
    }
    this.pulledDay = today;
    this.process.stations.forEach((_, station) => {
      this.scheduleReleases(station, index);
    });
    this.schedule((index + 1) * this.calendar.day, DAY_STARTS, null, null, index + 1);
  }

  private arrive(req: Request): void {
    const item: Item = {
      req,
      station: 0,
      status: "held",
      pass: 0,
      entered: req.at,
      released: req.at,
      deadline: Number.POSITIVE_INFINITY,
      started: 0,
      ends: 0,
      server: -1,
      epoch: 0,
    };
    this.items.add(item);
    this.enter(item, 0, req.at);
  }

  private enter(item: Item, station: number, enteredWall: number): void {
    const spec = this.spec(station);
    const state = this.at(station);
    item.station = station;
    item.pass = 0;
    item.entered = enteredWall;
    item.epoch++;
    item.server = -1;
    this.emit(station === 0 ? "arrive" : "enter", item, station);
    if (spec.bypass > 0 && this.ask(item, Q_BYPASS) < spec.bypass) {
      this.emit("auto", item, station);
      this.advance(item, station);
      return;
    }
    if (spec.patience) {
      const gone = enteredWall + quantile(spec.patience, this.ask(item, Q_PATIENCE));
      item.deadline = Math.max(this.now, this.calendar.workOfWall(gone));
      this.schedule(item.deadline, LEAVE, item, null, item.epoch);
    } else {
      item.deadline = Number.POSITIVE_INFINITY;
    }
    if (spec.releaseAt.length === 0) {
      item.status = "queued";
      item.released = this.wall;
      state.queue.push(item);
      this.requestDispatch(station);
    } else {
      item.status = "held";
      state.held.push(item);
    }
  }

  private release(station: number): void {
    const state = this.at(station);
    if (state.held.length === 0) return;
    const wall = this.wall;
    for (const item of state.held) {
      item.status = "queued";
      item.released = wall;
      state.queue.push(item);
      this.emit("release", item, station);
    }
    state.held.length = 0;
    this.requestDispatch(station);
  }

  private leave(item: Item, epoch: number): void {
    // The customer was picked up, or moved on, before running out of patience.
    if (item.epoch !== epoch) return;
    const state = this.at(item.station);
    remove(state.held, item);
    remove(state.queue, item);
    this.items.delete(item);
    this.emit("left", item, item.station);
  }

  private dispatch(station: number): void {
    const state = this.at(station);
    const spec = this.spec(station);
    state.dispatchPending = false;
    while (state.active.length < spec.servers && state.queue.length > 0) {
      // Whoever has waited longest goes next.
      const item = state.queue.shift() as Item;
      const touch = quantile(spec.touch, this.ask(item, Q_PASS + item.pass));
      item.status = "working";
      item.started = this.now;
      item.ends = this.now + Math.max(MIN_HANDLING, touch * spec.stretch);
      item.server = freeSeat(state.active, spec.servers);
      item.epoch++;
      state.active.push(item);
      this.schedule(item.ends, DONE, item, null, 0);
      this.emit("start", item, station);
    }
  }

  private done(item: Item): void {
    const station = item.station;
    const spec = this.spec(station);
    remove(this.at(station).active, item);
    this.emit("done", item, station);
    this.requestDispatch(station);
    if (item.pass === 0 && spec.rework > 0 && this.ask(item, Q_REWORK) < spec.rework) {
      item.status = "redo";
      item.pass = 1;
      item.server = -1;
      this.emit("redo", item, station);
      const back = this.calendar.workOfWall(this.wall + spec.reworkDelay);
      this.schedule(back, RETURN, item, null, 0);
      return;
    }
    this.advance(item, station);
  }

  private comeBack(item: Item): void {
    const state = this.at(item.station);
    item.status = "queued";
    item.entered = this.wall;
    item.released = this.wall;
    item.deadline = Number.POSITIVE_INFINITY;
    state.queue.push(item);
    this.emit("return", item, item.station);
    this.requestDispatch(item.station);
  }

  /** The item is finished at `station`: it leaves by choice, moves on, or waits to be paid. */
  private advance(item: Item, station: number): void {
    const last = this.process.stations.length - 1;
    if (item.req.exitAfter === station) {
      this.items.delete(item);
      this.emit("exit", item, station);
      return;
    }
    if (station < last) {
      this.enter(item, station + 1, this.wall);
      return;
    }
    item.status = "paying";
    item.station = last + 1;
    item.server = -1;
    this.emit("billed", item, last);
    const { payment } = this.process;
    const delay = payment ? quantile(payment, chance(item.req.key, Q_PAYMENT)) : 0;
    this.schedule(this.calendar.workOfWall(this.wall + delay), PAID, item, null, 0);
  }
}

function remove(list: Item[], item: Item): void {
  const index = list.indexOf(item);
  if (index >= 0) list.splice(index, 1);
}

/** The lowest-numbered person at the station who is not busy. */
function freeSeat(active: readonly Item[], servers: number): number {
  for (let seat = 0; seat < servers; seat++) {
    if (!active.some((item) => item.server === seat)) return seat;
  }
  return active.length;
}
