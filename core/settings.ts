/**
 * The Decision Lab's settings, and how they are written to and read from the page address, so
 * any view can be shared as a link. Anything out of range falls back to a safe value.
 */
import type { AiPolicy } from "./ai/signals";
import { DEFAULT_WEEK_ID, WEEKS } from "./dataset/weeks";
import { DEFAULT_ROUTING, type QueueOrder, type RoutingSettings } from "./routing/route";

export type ExtractionSource = "model" | "answer_key";
export type ViewMode = "explore" | "hood";

export interface LabSettings extends RoutingSettings {
  week: string;
  extraction: ExtractionSource;
}

export const LIMITS = {
  capacity: { min: 15, max: 120, step: 5 },
  threshold: { min: 30, max: 90, step: 1 },
  weight: { min: 0, max: 2, step: 0.1 },
} as const;

export const DEFAULT_SETTINGS: LabSettings = {
  ...DEFAULT_ROUTING,
  week: DEFAULT_WEEK_ID,
  extraction: "model",
};

const AI_POLICIES: AiPolicy[] = ["off", "high", "high_medium"];
const ORDERS: QueueOrder[] = ["score", "arrival"];

function clampNumber(
  raw: string | null,
  min: number,
  max: number,
  step: number,
  fallback: number,
): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const stepped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(4))));
}

function oneOf<T extends string>(raw: string | null, options: readonly T[], fallback: T): T {
  return raw !== null && (options as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseSettings(params: URLSearchParams): LabSettings {
  const d = DEFAULT_SETTINGS;
  const w = LIMITS.weight;
  return {
    week: oneOf(
      params.get("week"),
      WEEKS.map((week) => week.id),
      d.week,
    ),
    capacity: clampNumber(
      params.get("calls"),
      LIMITS.capacity.min,
      LIMITS.capacity.max,
      LIMITS.capacity.step,
      d.capacity,
    ),
    threshold: clampNumber(
      params.get("min"),
      LIMITS.threshold.min,
      LIMITS.threshold.max,
      LIMITS.threshold.step,
      d.threshold,
    ),
    aiPolicy: oneOf(params.get("ai"), AI_POLICIES, d.aiPolicy),
    queueOrder: oneOf(params.get("order"), ORDERS, d.queueOrder),
    weights: {
      fit: clampNumber(params.get("wfit"), w.min, w.max, w.step, d.weights.fit),
      intent: clampNumber(params.get("wintent"), w.min, w.max, w.step, d.weights.intent),
      ai: clampNumber(params.get("wai"), w.min, w.max, w.step, d.weights.ai),
    },
    extraction: oneOf(params.get("source"), ["model", "answer_key"] as const, d.extraction),
  };
}

/** Only values that differ from the defaults are written, so links stay short. */
export function serializeSettings(settings: LabSettings): URLSearchParams {
  const d = DEFAULT_SETTINGS;
  const params = new URLSearchParams();
  if (settings.week !== d.week) params.set("week", settings.week);
  if (settings.capacity !== d.capacity) params.set("calls", String(settings.capacity));
  if (settings.threshold !== d.threshold) params.set("min", String(settings.threshold));
  if (settings.aiPolicy !== d.aiPolicy) params.set("ai", settings.aiPolicy);
  if (settings.queueOrder !== d.queueOrder) params.set("order", settings.queueOrder);
  if (settings.weights.fit !== d.weights.fit) params.set("wfit", String(settings.weights.fit));
  if (settings.weights.intent !== d.weights.intent)
    params.set("wintent", String(settings.weights.intent));
  if (settings.weights.ai !== d.weights.ai) params.set("wai", String(settings.weights.ai));
  if (settings.extraction !== d.extraction) params.set("source", settings.extraction);
  return params;
}
