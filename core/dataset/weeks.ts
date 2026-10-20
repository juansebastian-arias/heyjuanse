/** The three synthetic weeks of inbound leads. Each week uses its own seed and the same assumptions. */
export interface WeekSpec {
  id: string;
  label: string;
  seed: number;
  /** Monday, ISO date. */
  start: string;
  /** Sunday, ISO date. */
  end: string;
}

export const WEEKS: readonly WeekSpec[] = [
  { id: "2026-w39", label: "Week 39", seed: 2026_039, start: "2026-09-21", end: "2026-09-27" },
  { id: "2026-w40", label: "Week 40", seed: 2026_040, start: "2026-09-28", end: "2026-10-04" },
  { id: "2026-w41", label: "Week 41", seed: 2026_041, start: "2026-10-05", end: "2026-10-11" },
] as const;

export const DEFAULT_WEEK_ID = "2026-w41";

/** Seed for the shared company universe (the simulated firmographic provider). */
export const COMPANY_UNIVERSE_SEED = 1729;

export function getWeek(id: string): WeekSpec {
  const week = WEEKS.find((candidate) => candidate.id === id);
  if (!week) throw new Error(`Unknown week ${id}`);
  return week;
}
