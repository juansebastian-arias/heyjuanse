/**
 * Draws the live company. Every request in the simulation has a dot; the dot's place and look
 * come straight from the request's state in the engine, and dots glide toward their place so the
 * eye can follow them. Nothing here decides anything: it only shows what the engine did.
 */
import type { Item } from "@/core/flow/engine";
import type { Live } from "@/lib/flow/live";
import {
  type Geometry,
  type Point,
  place,
  placeDown,
  type Rect,
  type Stack,
  stackFor,
} from "./geometry";

export interface Palette {
  ink: string;
  rule: string;
  ruleStrong: string;
  operable: string;
  good: string;
  bad: string;
  muted: string;
  font: string;
}

type Look =
  /** Arrived, not yet handed to anyone. */
  | "held"
  | "queued"
  | "working"
  /** Sent back, waiting to return. */
  | "redo"
  /** Invoice sent, payment pending. */
  | "pending"
  /** Gave up waiting: a would-be buyer, or someone who would not have bought anyway. */
  | "lostBuyer"
  | "lost"
  | "paid"
  /** Left by choice; fading out. */
  | "gone";

interface Sprite {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  r: number;
  alpha: number;
  talpha: number;
  look: Look;
  /** Share of the current handling that is done, for requests at a desk. */
  progress: number;
  /** The frame this sprite was last placed by the engine's state. */
  stamp: number;
  /** For sprites on their way out: milliseconds left before they are removed. */
  ttl: number;
}

/** How quickly dots close the distance to their place: the time to cover about two thirds of it. */
const GLIDE_MS = 110;
const FADE_MS = 520;
/** How transparent a waiting dot gets as its customer's patience runs out. */
const PATIENCE_FADE = 0.62;

export class Stage {
  private readonly sprites = new Map<number, Sprite>();
  private readonly trays: number[][];
  private paidTray: number[] = [];
  private overflow: Array<{ at: Point; extra: number }> = [];
  private stamp = 0;

  constructor(private readonly stations: number) {
    this.trays = Array.from({ length: stations }, () => []);
  }

  /** Forgets everyone who gave up or paid, so the trays show only what happens from now on. */
  clearTrays(): void {
    for (const tray of this.trays) {
      for (const id of tray.splice(0)) this.dismiss(id);
    }
    for (const id of this.paidTray.splice(0)) this.dismiss(id);
  }

  /** Puts every dot where the engine says its request is. `snap` skips the glide. */
  update(live: Live, g: Geometry, elapsedMs: number, snap: boolean): void {
    this.stamp++;
    this.overflow = [];
    const { sim } = live;
    const base = g.stacked ? 2.7 : 3.1;
    const radius = (item: Item, cell: number) =>
      Math.min(cell / 2 - 0.4, base * (0.75 + Math.sqrt(item.req.size) / 14));

    g.stations.forEach((box, index) => {
      const state = sim.station(index);
      const waiting = state.queue.length + state.held.length;
      const stack = stackFor(box.wait, waiting, g.cell, g.stacked);
      this.noteOverflow(box.wait, stack, waiting, g.stacked);
      let slot = 0;
      for (const list of [state.queue, state.held]) {
        for (const item of list) {
          const sprite = this.sprite(item, g);
          const at = place(box.wait, stack, slot++, g.stacked);
          sprite.look = item.status === "held" ? "held" : "queued";
          sprite.r = radius(item, stack.cell);
          sprite.talpha = 1 - PATIENCE_FADE * this.impatience(live, item);
          this.aim(sprite, at);
        }
      }
      for (const item of state.active) {
        const sprite = this.sprite(item, g);
        sprite.look = "working";
        sprite.r = Math.min(g.seat / 2 - 2.5, radius(item, g.cell));
        sprite.talpha = 1;
        sprite.progress = (sim.now - item.started) / Math.max(1e-9, item.ends - item.started);
        this.aim(sprite, box.desks[item.server] ?? box.desks[0] ?? { x: 0, y: 0 });
      }
    });

    const pending: Item[] = [];
    const redo: Item[] = [];
    for (const item of sim.items) {
      if (item.status === "paying") pending.push(item);
      else if (item.status === "redo") redo.push(item);
    }
    const stack = stackFor(g.pending, pending.length, g.cell, g.stacked);
    this.noteOverflow(g.pending, stack, pending.length, g.stacked);
    pending.forEach((item, index) => {
      const sprite = this.sprite(item, g);
      sprite.look = "pending";
      sprite.r = radius(item, stack.cell);
      sprite.talpha = 0.5;
      this.aim(sprite, placeDown(g.pending, stack, index, g.stacked));
    });
    redo.forEach((item, index) => {
      const box = g.stations[item.station];
      if (!box) return;
      const sprite = this.sprite(item, g);
      sprite.look = "redo";
      sprite.r = radius(item, g.cell);
      sprite.talpha = 1;
      const step = g.cell + 1;
      this.aim(
        sprite,
        g.stacked
          ? { x: box.redo.x, y: box.redo.y + index * step }
          : { x: box.redo.x - index * step, y: box.redo.y },
      );
    });

    for (const departure of live.departures.splice(0)) {
      const { item } = departure;
      let sprite = this.sprites.get(item.req.id);
      if (departure.kind === "exit") {
        // Left by choice: a polite no, a declined quote. The dot drifts off and fades.
        if (!sprite) continue;
        sprite.stamp = this.stamp;
        sprite.look = "gone";
        sprite.talpha = 0;
        sprite.ttl = FADE_MS;
        this.aim(sprite, { x: sprite.x + (g.stacked ? 0 : 10), y: sprite.y - 16 });
        continue;
      }
      // Everyone who gave up or paid is kept, also when it happened between two frames of a
      // time-lapse, so the trays always agree with the counts written next to them.
      const tray = departure.kind === "left" ? g.stations[departure.station]?.tray : g.paid;
      if (!tray) continue;
      if (!sprite) {
        sprite = this.sprite(item, g);
        sprite.x = tray.x + tray.w / 2;
        sprite.y = tray.y + tray.h / 2;
        sprite.r = radius(item, g.cell);
      }
      sprite.stamp = this.stamp;
      sprite.talpha = 1;
      if (departure.kind === "left") {
        sprite.look = departure.buyer ? "lostBuyer" : "lost";
        this.trays[departure.station]?.push(sprite.id);
      } else {
        sprite.look = "paid";
        this.paidTray.push(sprite.id);
      }
    }

    g.stations.forEach((box, index) => {
      const tray = this.trays[index];
      if (tray) this.settle(tray, box.tray, g);
    });
    this.settle(this.paidTray, g.paid, g);

    const glide = snap ? 1 : 1 - Math.exp(-elapsedMs / GLIDE_MS);
    const fade = snap ? 1 : 1 - Math.exp(-elapsedMs / 160);
    for (const sprite of this.sprites.values()) {
      if (sprite.ttl > 0) {
        sprite.ttl -= elapsedMs;
        if (sprite.ttl <= 0 || snap) {
          this.sprites.delete(sprite.id);
          continue;
        }
      } else if (sprite.stamp !== this.stamp) {
        // Its request is no longer anywhere the engine knows about.
        this.sprites.delete(sprite.id);
        continue;
      }
      sprite.x += (sprite.tx - sprite.x) * glide;
      sprite.y += (sprite.ty - sprite.y) * glide;
      sprite.alpha += (sprite.talpha - sprite.alpha) * fade;
    }
  }

  draw(ctx: CanvasRenderingContext2D, g: Geometry, colors: Palette): void {
    ctx.clearRect(0, 0, g.width, g.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.ruleStrong;
    const half = g.seat / 2;
    for (const box of g.stations) {
      for (const desk of box.desks) {
        ctx.beginPath();
        ctx.roundRect(desk.x - half, desk.y - half, g.seat, g.seat, 3);
        ctx.stroke();
      }
    }
    for (const sprite of this.sprites.values()) {
      if (sprite.alpha < 0.02) continue;
      ctx.globalAlpha = Math.min(1, sprite.alpha);
      const hollow = sprite.look === "held" || sprite.look === "lost" || sprite.look === "redo";
      const color =
        sprite.look === "lost" || sprite.look === "lostBuyer"
          ? colors.bad
          : sprite.look === "paid"
            ? colors.good
            : colors.ink;
      ctx.beginPath();
      ctx.arc(sprite.x, sprite.y, hollow ? Math.max(1, sprite.r - 0.6) : sprite.r, 0, Math.PI * 2);
      if (hollow) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = color;
        if (sprite.look === "redo") ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
      if (sprite.look === "working") {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.operable;
        ctx.beginPath();
        const turn = Math.max(0, Math.min(1, sprite.progress)) * Math.PI * 2;
        ctx.arc(sprite.x, sprite.y, half - 1, -Math.PI / 2, -Math.PI / 2 + turn);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.muted;
    ctx.font = `500 10px ${colors.font}`;
    ctx.textBaseline = "middle";
    for (const note of this.overflow) {
      ctx.fillText(`+${note.extra}`, note.at.x, note.at.y);
    }
  }

  /** A request's dot, created where requests appear the first time it is seen. */
  private sprite(item: Item, g: Geometry): Sprite {
    let sprite = this.sprites.get(item.req.id);
    if (!sprite) {
      sprite = {
        id: item.req.id,
        x: g.entry.x,
        y: g.entry.y,
        tx: g.entry.x,
        ty: g.entry.y,
        r: 3,
        alpha: 0,
        talpha: 1,
        look: "queued",
        progress: 0,
        stamp: 0,
        ttl: 0,
      };
      this.sprites.set(item.req.id, sprite);
    }
    sprite.stamp = this.stamp;
    return sprite;
  }

  private aim(sprite: Sprite, at: Point): void {
    sprite.tx = at.x;
    sprite.ty = at.y;
  }

  /** How far through their patience a waiting customer is, from 0 to 1. */
  private impatience(live: Live, item: Item): number {
    if (!Number.isFinite(item.deadline)) return 0;
    const entered = live.sim.calendar.workOfWall(item.entered);
    const span = item.deadline - entered;
    if (span <= 0) return 1;
    return Math.max(0, Math.min(1, (live.sim.now - entered) / span));
  }

  private noteOverflow(rect: Rect, stack: Stack, total: number, stacked: boolean): void {
    if (total <= stack.capacity) return;
    const last = stacked
      ? place(rect, stack, stack.capacity - 1, true)
      : place(rect, stack, stack.capacity - 1, false);
    this.overflow.push({
      at: { x: last.x + stack.cell * 0.8, y: last.y },
      extra: total - stack.capacity,
    });
  }

  /** Keeps a tray to what fits, oldest out first, and lines its dots up. */
  private settle(tray: number[], rect: Rect, g: Geometry): void {
    const stack = stackFor(rect, tray.length, g.cell, g.stacked);
    while (tray.length > stack.capacity) {
      const oldest = tray.shift();
      if (oldest !== undefined) this.dismiss(oldest);
    }
    tray.forEach((id, index) => {
      const sprite = this.sprites.get(id);
      if (!sprite) return;
      sprite.stamp = this.stamp;
      sprite.r = Math.min(sprite.r, stack.cell / 2 - 0.4);
      this.aim(sprite, placeDown(rect, stack, index, g.stacked));
    });
  }

  private dismiss(id: number): void {
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    sprite.talpha = 0;
    sprite.ttl = FADE_MS;
  }
}
