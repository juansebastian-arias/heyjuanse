/** Formatting for the GTM simulator. Minus signs are true minus signs. */

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

export function formatSigned(value: number): string {
  if (value === 0) return "±0";
  return value > 0
    ? `+${value.toLocaleString("en-US")}`
    : `−${Math.abs(value).toLocaleString("en-US")}`;
}

export function formatSignedMoney(value: number): string {
  if (!Number.isFinite(value)) return "–";
  if (Math.round(value) === 0) return "±$0";
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}
