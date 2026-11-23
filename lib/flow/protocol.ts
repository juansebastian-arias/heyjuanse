/** Messages between the page and the workers that run simulations for it. */
import type { Setup } from "@/core/flow/company";
import type { Summary } from "@/core/flow/experiment";
import type { Tweaks } from "@/core/flow/scenario";
import type { Check } from "@/core/flow/validate";

export type Job =
  | { id: number; kind: "runs"; setup: Setup; tweaks: Tweaks; seeds: number[] }
  | { id: number; kind: "checks"; customers: number };

export type Reply =
  | { id: number; ok: true; kind: "runs"; summaries: Summary[] }
  | { id: number; ok: true; kind: "checks"; checks: Check[] }
  | { id: number; ok: false; error: string };
