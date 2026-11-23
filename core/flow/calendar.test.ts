import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ALWAYS, CLOSE, clockLabel, DAY, OFFICE, OPEN, WORK_DAY } from "./calendar";

const MON = 0;
const TUE = DAY;
const FRI = 4 * DAY;
const SAT = 5 * DAY;
const NEXT_MON = 7 * DAY;

describe("office calendar", () => {
  it("starts the working clock on Monday at 9:00", () => {
    expect(OFFICE.wallOfWork(0)).toBe(MON + OPEN);
    expect(OFFICE.wallOfWork(WORK_DAY)).toBe(TUE + OPEN);
    expect(OFFICE.wallOfWork(5 * WORK_DAY)).toBe(NEXT_MON + OPEN);
    expect(OFFICE.wallOfWork(WORK_DAY + 90)).toBe(TUE + OPEN + 90);
  });

  it("moves anything that happens while the office is closed to the next opening", () => {
    expect(OFFICE.workOfWall(MON + 8 * 60)).toBe(0);
    expect(OFFICE.workOfWall(MON + CLOSE + 30)).toBe(WORK_DAY);
    expect(OFFICE.workOfWall(FRI + CLOSE + 60)).toBe(5 * WORK_DAY);
    expect(OFFICE.workOfWall(SAT + 12 * 60)).toBe(5 * WORK_DAY);
    expect(OFFICE.workOfWall(SAT + DAY + 23 * 60)).toBe(5 * WORK_DAY);
  });

  it("keeps office-hours instants where they are", () => {
    expect(OFFICE.workOfWall(MON + OPEN)).toBe(0);
    expect(OFFICE.workOfWall(TUE + 14 * 60)).toBe(WORK_DAY + 5 * 60);
  });

  it("maps working days onto weekdays only", () => {
    const days = Array.from({ length: 12 }, (_, index) => OFFICE.calendarDay(index));
    expect(days).toEqual([0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15]);
  });

  it("round-trips any working instant through the calendar", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200_000, noNaN: true }), (work) => {
        expect(OFFICE.workOfWall(OFFICE.wallOfWork(work))).toBeCloseTo(work, 6);
      }),
    );
  });

  it("gives the first working instant at or after any calendar minute, and never goes back", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 400_000, noNaN: true }),
        fc.double({ min: 0, max: 5_000, noNaN: true }),
        (wall, later) => {
          const work = OFFICE.workOfWall(wall);
          expect(OFFICE.wallOfWork(work)).toBeGreaterThanOrEqual(wall - 1e-6);
          expect(OFFICE.workOfWall(wall + later)).toBeGreaterThanOrEqual(work);
        },
      ),
    );
  });

  it("labels calendar minutes", () => {
    expect(clockLabel(MON + OPEN)).toBe("Mon 09:00");
    expect(clockLabel(SAT + 14 * 60 + 5)).toBe("Sat 14:05");
    expect(clockLabel(NEXT_MON + 23 * 60 + 59.7)).toBe("Mon 23:59");
  });
});

describe("round-the-clock calendar", () => {
  it("makes the two clocks the same", () => {
    expect(ALWAYS.wallOfWork(1234.5)).toBe(1234.5);
    expect(ALWAYS.workOfWall(1234.5)).toBe(1234.5);
    expect(ALWAYS.calendarDay(9)).toBe(9);
    expect(ALWAYS.day).toBe(DAY);
  });
});
