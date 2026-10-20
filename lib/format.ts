/** Number and date formatting used across the site. */
export const formatCount = (value: number) => value.toLocaleString("en-US");

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || Number.isNaN(value)) return "–";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })} UTC`;
}

export function signed(value: number): string {
  if (value === 0) return "±0";
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}
