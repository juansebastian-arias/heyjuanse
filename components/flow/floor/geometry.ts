/**
 * Where everything on the floor goes. On a wide screen the five teams stand side by side and
 * requests move left to right; on a narrow one they are stacked and requests move down. The
 * labels are HTML laid over the drawing, so the sizes here are shared with Floor.module.css.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StationBox {
  /** Where waiting requests stack, nearest the desks first. */
  wait: Rect;
  /** One desk per person. */
  desks: Point[];
  /** Where requests that gave up collect. */
  tray: Rect;
  /** Where work that was sent back waits to return. */
  redo: Point;
}

export interface Geometry {
  width: number;
  height: number;
  /** Teams stacked top to bottom instead of side by side. */
  stacked: boolean;
  /** Distance between the centers of two neighboring dots. */
  cell: number;
  /** Side of a desk. */
  seat: number;
  stations: StationBox[];
  /** Invoices sent and not yet paid, and payments received. */
  pending: Rect;
  paid: Rect;
  /** Where a new request appears. */
  entry: Point;
}

/** Below this width the teams are stacked. Floor.module.css uses the same number. */
export const STACK_BELOW = 620;

/** Heights of the drawing, and the bands the labels occupy. Mirrored in Floor.module.css. */
export const WIDE = { height: 340, header: 94, tray: 86, caption: 38 };
export const STACKED = { row: 64, label: 96, tray: 78 };

export function heightFor(width: number, stations: number): number {
  return width < STACK_BELOW ? STACKED.row * (stations + 1) : WIDE.height;
}

export function layout(width: number, servers: readonly number[]): Geometry {
  return width < STACK_BELOW ? stackedLayout(width, servers) : wideLayout(width, servers);
}

function wideLayout(width: number, servers: readonly number[]): Geometry {
  const columns = servers.length + 1;
  const column = width / columns;
  const pad = Math.max(10, Math.min(18, column * 0.09));
  const height = WIDE.height;
  const seat = 18;
  const deskY = height - WIDE.tray - 20;
  const waitTop = WIDE.header;
  const waitBottom = deskY - seat / 2 - 8;
  const trayTop = deskY + seat / 2 + 14;
  const trayBottom = height - WIDE.caption - 4;
  const stations = servers.map((people, index): StationBox => {
    const x = index * column;
    const center = x + column / 2;
    const inner = column - 2 * pad;
    const gap = Math.min(seat + 8, inner / Math.max(1, people));
    return {
      wait: { x: x + pad, y: waitTop, w: inner, h: waitBottom - waitTop },
      desks: Array.from({ length: people }, (_, i) => ({
        x: center + (i - (people - 1) / 2) * gap,
        y: deskY,
      })),
      tray: { x: x + pad, y: trayTop, w: inner, h: trayBottom - trayTop },
      redo: { x: x + column - pad - 6, y: waitTop + 6 },
    };
  });
  const x = servers.length * column;
  return {
    width,
    height,
    stacked: false,
    cell: 11,
    seat,
    stations,
    pending: { x: x + pad, y: waitTop, w: column - 2 * pad, h: deskY + seat / 2 - waitTop },
    paid: { x: x + pad, y: trayTop, w: column - 2 * pad, h: trayBottom - trayTop },
    entry: { x: -12, y: waitBottom - 20 },
  };
}

function stackedLayout(width: number, servers: readonly number[]): Geometry {
  const row = STACKED.row;
  const seat = 16;
  const left = STACKED.label + 12;
  const trayLeft = width - STACKED.tray;
  const stations = servers.map((people, index): StationBox => {
    const y = index * row;
    const middle = y + row / 2;
    const desksEnd = left + people * (seat + 4);
    return {
      wait: { x: desksEnd + 8, y: y + 10, w: trayLeft - 8 - (desksEnd + 8), h: row - 20 },
      desks: Array.from({ length: people }, (_, i) => ({
        x: left + seat / 2 + i * (seat + 4),
        y: middle,
      })),
      tray: { x: trayLeft, y: y + 8, w: STACKED.tray - 6, h: row - 28 },
      redo: { x: trayLeft - 14, y: y + 12 },
    };
  });
  const y = servers.length * row;
  const span = width - left - 6;
  return {
    width,
    height: row * (servers.length + 1),
    stacked: true,
    cell: 9,
    seat,
    stations,
    pending: { x: left, y: y + 10, w: span * 0.5, h: row - 20 },
    paid: { x: left + span * 0.56, y: y + 8, w: span * 0.44, h: row - 28 },
    entry: { x: left, y: -10 },
  };
}

export interface Stack {
  cell: number;
  /** Dots per line, lines that fit and how many dots that makes. */
  across: number;
  lines: number;
  capacity: number;
}

/** How `total` dots fit in a rectangle: the cell shrinks, down to a minimum, when there are many. */
export function stackFor(rect: Rect, total: number, cell: number, stacked: boolean): Stack {
  const min = 5;
  let size = cell;
  const sized = (s: number) => {
    const across = Math.max(1, Math.floor((stacked ? rect.h : rect.w) / s));
    const lines = Math.max(1, Math.floor((stacked ? rect.w : rect.h) / s));
    return { cell: s, across, lines, capacity: across * lines };
  };
  let stack = sized(size);
  while (stack.capacity < total && size > min) {
    size -= 1;
    stack = sized(size);
  }
  return stack;
}

/**
 * The center of the dot at `index` in a stack. Side by side, a stack fills left to right in
 * lines that grow upward from the bottom, so the next to be served is nearest the desks; stacked,
 * it fills top to bottom in lines that grow to the right.
 */
export function place(rect: Rect, stack: Stack, index: number, stacked: boolean): Point {
  const slot = Math.min(index, stack.capacity - 1);
  const along = slot % stack.across;
  const line = Math.floor(slot / stack.across);
  const half = stack.cell / 2;
  if (stacked) {
    return { x: rect.x + half + line * stack.cell, y: rect.y + half + along * stack.cell };
  }
  return { x: rect.x + half + along * stack.cell, y: rect.y + rect.h - half - line * stack.cell };
}

/** Like `place`, for trays and payments: lines grow downward from the top. */
export function placeDown(rect: Rect, stack: Stack, index: number, stacked: boolean): Point {
  const slot = Math.min(index, stack.capacity - 1);
  const along = slot % stack.across;
  const line = Math.floor(slot / stack.across);
  const half = stack.cell / 2;
  if (stacked) {
    return { x: rect.x + half + line * stack.cell, y: rect.y + half + along * stack.cell };
  }
  return { x: rect.x + half + along * stack.cell, y: rect.y + half + line * stack.cell };
}
