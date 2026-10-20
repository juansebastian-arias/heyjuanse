/**
 * The lead marks on the home page. They are the rules engine's real output for the default
 * week and settings, computed when the site is built.
 */
import type { LeadAiSignals } from "@/core/ai/signals";
import { indexLabels, leadHasNeed } from "@/core/backtest/metrics";
import { prepareWeek } from "@/core/cleaning/pipeline";
import { LANES, type Lane, routeLeads } from "@/core/routing/route";
import { DEFAULT_SETTINGS } from "@/core/settings";
import { readWeek } from "./week-files";

export interface LobbyLane {
  lane: Lane;
  marks: Array<{ need: boolean; waiting: boolean }>;
}

export interface LobbySnapshot {
  weekLabel: string;
  leads: number;
  submissions: number;
  needs: number;
  called: number;
  calledWithNeed: number;
  capacity: number;
  lanes: LobbyLane[];
}

export function lobbySnapshot(): LobbySnapshot {
  const { leads: file, labels } = readWeek(DEFAULT_SETTINGS.week);
  const prepared = prepareWeek(file);
  const index = indexLabels(labels, prepared.leads);
  const decisions = routeLeads(prepared.leads, new Map<string, LeadAiSignals>(), DEFAULT_SETTINGS);
  const lanes: LobbyLane[] = LANES.map((lane) => {
    const inLane = decisions
      .filter((decision) => decision.lane === lane)
      .sort((a, b) =>
        lane === "sales"
          ? (a.queuePosition ?? 0) - (b.queuePosition ?? 0)
          : b.score.total - a.score.total || a.leadId.localeCompare(b.leadId),
      );
    return {
      lane,
      marks: inLane.map((decision) => ({
        need: leadHasNeed(decision.leadId, index),
        waiting: decision.lane === "sales" && !decision.called,
      })),
    };
  });
  const called = decisions.filter((decision) => decision.called);
  return {
    weekLabel: file.label,
    leads: decisions.length,
    submissions: file.rawLeads.length,
    needs: [...index.needByPerson.values()].filter(Boolean).length,
    called: called.length,
    calledWithNeed: called.filter((decision) => leadHasNeed(decision.leadId, index)).length,
    capacity: DEFAULT_SETTINGS.capacity,
    lanes,
  };
}
