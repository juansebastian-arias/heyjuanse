/** Formatting for the flow model. Minus signs are true minus signs; rounding never invents precision. */

const MINUS = "−";

const trim = (text: string) => text.replace(/\.0$/, "");

/** "$350k", "$1.2M", "$800". */
export function money(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  if (abs >= 999_500) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 9_950_000 ? 0 : 1)}M`;
  if (abs >= 9_950) return `${sign}$${Math.round(abs / 1000)}k`;
  if (abs >= 1_000) return `${sign}$${trim((abs / 1000).toFixed(1))}k`;
  return `${sign}$${Math.round(abs)}`;
}

/** "+$40k", "−$3k", "$0". */
export function signedMoney(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const text = money(Math.abs(value));
  if (text === "$0") return "$0";
  return `${value > 0 ? "+" : MINUS}${text}`;
}

/** A count with one decimal below ten and none above. */
export function count(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const text = abs < 9.95 ? trim(abs.toFixed(1)) : Math.round(abs).toLocaleString("en-US");
  return value < 0 && text !== "0" ? `${MINUS}${text}` : text;
}

export function signedCount(value: number): string {
  const text = count(Math.abs(value));
  if (text === "0") return "0";
  return `${value > 0 ? "+" : MINUS}${text}`;
}

/** A length of time given in hours: "18 min", "5 h", "2.3 days". */
export function duration(hours: number): string {
  if (!Number.isFinite(hours)) return "–";
  if (hours < 0.0083) return "0 min";
  // Up to 59 minutes and a half; anything closer to the hour is written as an hour.
  if (hours * 60 < 59.5) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 9.95) return `${trim(hours.toFixed(1))} h`;
  if (hours < 47.5) return `${Math.round(hours)} h`;
  return `${trim((hours / 24).toFixed(1))} days`;
}

/** "14.7 days", "1 day". */
export function days(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const text = value < 9.95 ? trim(value.toFixed(1)) : String(Math.round(value));
  return `${text} ${text === "1" ? "day" : "days"}`;
}

/** "87%". */
export function percent(share: number): string {
  if (!Number.isFinite(share)) return "–";
  return `${Math.round(share * 100)}%`;
}

/** Hours of work a day: "6 h", "1.5 h". */
export function hoursPerDay(hours: number): string {
  if (!Number.isFinite(hours)) return "–";
  return `${hours < 9.95 ? trim(hours.toFixed(1)) : Math.round(hours)} h`;
}

/**
 * How long a change takes to repay what it cost to build. Kept coarse on purpose: the model
 * compares settled quarters and does not simulate the weeks a change takes to bed in.
 */
export function payback(months: number): string {
  if (months < 1) return "within a month";
  if (months < 1.5) return "in about a month";
  return `in about ${Math.round(months)} months`;
}

export function plural(value: number, one: string, many: string): string {
  return Math.abs(value - 1) < 0.05 ? one : many;
}
