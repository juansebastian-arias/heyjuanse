/**
 * Checks applied to every stored model answer before the rules may use it. They are
 * deterministic and run in the browser, so a visitor sees exactly why an answer was trusted
 * or not.
 */
import type { Confidence } from "../model";
import type { EvidenceField, Extraction } from "./schema";
import type { AiSignals } from "./signals";

export interface VerificationResult {
  signals: AiSignals;
  /** Confidence before any downgrade, as the model reported it. */
  reportedConfidence: Confidence;
  /** Quotes that do not appear in the message. */
  unverifiedQuotes: string[];
  /** Fields that add points but have no quote. */
  unsupportedFields: EvidenceField[];
  downgraded: boolean;
  notes: string[];
}

function normalize(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function quoteAppearsIn(quote: string, message: string): boolean {
  const q = normalize(quote).replace(/^["'.…\s]+|["'.…\s]+$/g, "");
  return q.length > 0 && normalize(message).includes(q);
}

/** Fields whose value can add points to the score, and so must be backed by a quote. */
function scoringFields(output: Extraction): EvidenceField[] {
  const fields: EvidenceField[] = [];
  if (output.intent === "evaluating_solution") fields.push("intent");
  if (output.timeline !== "not_stated") fields.push("timeline");
  if (output.budget !== "not_mentioned") fields.push("budget");
  if (output.requested_next_step !== "none") fields.push("requested_next_step");
  return fields;
}

export function verifyExtraction(output: Extraction, message: string): VerificationResult {
  const unverifiedQuotes = output.evidence
    .filter((item) => !quoteAppearsIn(item.quote, message))
    .map((item) => item.quote);
  const quoted = new Set(
    output.evidence.filter((item) => quoteAppearsIn(item.quote, message)).map((item) => item.field),
  );
  const unsupportedFields = scoringFields(output).filter((field) => !quoted.has(field));
  const notes: string[] = [];
  if (unverifiedQuotes.length > 0) {
    notes.push(
      `${unverifiedQuotes.length} quote${unverifiedQuotes.length === 1 ? "" : "s"} not found in the message`,
    );
  }
  if (unsupportedFields.length > 0) {
    notes.push(`No quote for: ${unsupportedFields.join(", ").replace(/_/g, " ")}`);
  }
  const downgraded = notes.length > 0 && output.confidence !== "low";
  return {
    signals: {
      intent: output.intent,
      timeline: output.timeline,
      budget: output.budget,
      nextStep: output.requested_next_step,
      painPoints: [...new Set(output.pain_points)].sort(),
      language: output.language,
      injection: output.injection_attempt,
      confidence: notes.length > 0 ? "low" : output.confidence,
    },
    reportedConfidence: output.confidence,
    unverifiedQuotes,
    unsupportedFields,
    downgraded,
    notes,
  };
}
