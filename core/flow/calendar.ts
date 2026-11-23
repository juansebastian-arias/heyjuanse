/**
 * Two clocks. Customers wait in calendar time: nights and weekends count. Teams work in office
 * time: 9:00 to 18:00, Monday to Friday. The simulation runs on the office clock, as one unbroken
 * line of working minutes, and converts to and from the calendar where a customer's patience or
 * an arrival at night is involved.
 *
 * Calendar minute 0 is a Monday at 00:00. Working minute 0 is that Monday at 9:00.
 */

export const DAY = 24 * 60;
/** Minute of the day the office opens and closes. */
export const OPEN = 9 * 60;
export const CLOSE = 18 * 60;
/** Working minutes in one office day. */
export const WORK_DAY = CLOSE - OPEN;
export const WORK_DAYS_PER_WEEK = 5;

export interface Calendar {
  /** Minutes of working time in one cycle of releases and demand: an office day, or 24 hours. */
  readonly day: number;
  /** The calendar minute that a working-time instant falls on. */
  wallOfWork(work: number): number;
  /** The first working-time instant at which something that happened at a calendar minute can be acted on. */
  workOfWall(wall: number): number;
  /** The calendar day (0 = the first Monday) that working day `index` falls on. */
  calendarDay(index: number): number;
}

/** Monday to Friday, 9:00 to 18:00. */
export const OFFICE: Calendar = {
  day: WORK_DAY,
  wallOfWork(work) {
    const index = Math.floor(work / WORK_DAY);
    return OFFICE.calendarDay(index) * DAY + OPEN + (work - index * WORK_DAY);
  },
  workOfWall(wall) {
    const day = Math.floor(wall / DAY);
    const minute = wall - day * DAY;
    const week = Math.floor(day / 7);
    const weekday = day - week * 7;
    // Saturday and Sunday: nothing happens until Monday opens.
    if (weekday >= WORK_DAYS_PER_WEEK) return (week + 1) * WORK_DAYS_PER_WEEK * WORK_DAY;
    const index = week * WORK_DAYS_PER_WEEK + weekday;
    if (minute < OPEN) return index * WORK_DAY;
    // After closing: the next working day, which for a Friday is the following Monday.
    if (minute >= CLOSE) return (index + 1) * WORK_DAY;
    return index * WORK_DAY + (minute - OPEN);
  },
  calendarDay(index) {
    return Math.floor(index / WORK_DAYS_PER_WEEK) * 7 + (index % WORK_DAYS_PER_WEEK);
  },
};

/**
 * A team that never sleeps: the two clocks are the same. Used to check the engine against
 * textbook queueing formulas, which assume it.
 */
export const ALWAYS: Calendar = {
  day: DAY,
  wallOfWork: (work) => work,
  workOfWall: (wall) => wall,
  calendarDay: (index) => index,
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "Tue 14:05" for a calendar minute. */
export function clockLabel(wall: number): string {
  const day = Math.floor(wall / DAY);
  const minute = Math.floor(wall - day * DAY);
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${WEEKDAYS[((day % 7) + 7) % 7]} ${hh}:${mm}`;
}
