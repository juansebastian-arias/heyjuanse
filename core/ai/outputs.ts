/**
 * Turning a stored model run into per-lead signals the rules can use.
 */
import type { Lead } from "../cleaning/pipeline";
import type { AiRunFile, StoredExtraction } from "./schema";
import { combineSignals, type LeadAiSignals } from "./signals";
import { type VerificationResult, verifyExtraction } from "./verify";

export interface MessageAi {
  rawId: string;
  stored: StoredExtraction;
  verification: VerificationResult | null;
}

export interface AiIndex {
  byMessage: Map<string, MessageAi>;
  byLead: Map<string, LeadAiSignals>;
}

export function indexAiRun(run: AiRunFile, leads: Lead[]): AiIndex {
  const stored = new Map(run.results.map((result) => [result.rawId, result]));
  const byMessage = new Map<string, MessageAi>();
  const byLead = new Map<string, LeadAiSignals>();
  for (const lead of leads) {
    const usable: Array<{ rawId: string; signals: VerificationResult["signals"] }> = [];
    for (const message of lead.messages) {
      const result = stored.get(message.rawId);
      if (!result) continue;
      const verification =
        result.status === "ok" && result.output
          ? verifyExtraction(result.output, message.text)
          : null;
      byMessage.set(message.rawId, { rawId: message.rawId, stored: result, verification });
      if (verification) usable.push({ rawId: message.rawId, signals: verification.signals });
    }
    const combined = combineSignals(usable);
    if (combined) byLead.set(lead.leadId, combined);
  }
  return { byMessage, byLead };
}
