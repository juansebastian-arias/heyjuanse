"use client";

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import type { MessageAi } from "@/core/ai/outputs";
import type { LeadAiSignals } from "@/core/ai/signals";
import { quoteAppearsIn } from "@/core/ai/verify";
import { plural } from "@/core/backtest/explain";
import { leadHasNeed } from "@/core/backtest/metrics";
import { countryName, MATCH_METHOD_LABELS } from "@/core/cleaning/enrich";
import {
  BUDGET_LABELS,
  INDUSTRY_LABELS,
  INTENT_LABELS,
  LANGUAGE_LABELS,
  NEXT_STEP_LABELS,
  PAIN_POINT_LABELS,
  REGION_LABELS,
  SIZE_LABELS,
  SOURCE_LABELS,
  TIMELINE_LABELS,
} from "@/core/model";
import { DATA_RULES, type Decision, LANE_LABELS, REASONS } from "@/core/routing/route";
import {
  type NoAiPointsReason,
  type TraceStep,
  traceDecision,
  whyNoAiPoints,
} from "@/core/routing/trace";
import type { LabSettings } from "@/core/settings";
import { formatDate, formatDateTime, signed } from "@/lib/format";
import type { WeekData } from "@/lib/lab/data";
import styles from "./CaseFile.module.css";

const NO_AI_POINTS: Record<NoAiPointsReason, string> = {
  data_rule:
    "No AI points: a data rule decided this lead first, and AI cannot override a data rule.",
  injection:
    "No AI points: the message tried to instruct the AI, so its reading was set aside and a person reviews the lead.",
  untrusted: "No AI points: the signal was not trusted under the current policy.",
  nothing_scored:
    "No AI points: the signal was trusted, but nothing it found carries points. Only evaluating a solution, a stated timeline or budget, or a request for a demo, pricing or a call does.",
};

interface CaseFileProps {
  leadId: string | null;
  data: WeekData;
  decisions: Decision[];
  settings: LabSettings;
  aiByLead: ReadonlyMap<string, LeadAiSignals>;
  onClose: () => void;
  onNavigate: (leadId: string) => void;
}

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Message text with the model's verified quotes highlighted. Rendered as text, never as HTML. */
function HighlightedMessage({ text, quotes }: { text: string; quotes: string[] }) {
  const ranges: Array<[number, number]> = [];
  const lower = text.toLowerCase();
  for (const quote of quotes) {
    const needle = quote.trim().toLowerCase();
    if (!needle) continue;
    const start = lower.indexOf(needle);
    if (start >= 0) ranges.push([start, start + needle.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>);
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <p className={styles.message}>{parts}</p>;
}

function AiOutput({
  messageAi,
  model,
  generatedAt,
}: {
  messageAi: MessageAi | undefined;
  model: string;
  generatedAt: string;
}) {
  if (!messageAi) {
    return <p className={styles.muted}>No stored AI output for this message.</p>;
  }
  const { stored, verification } = messageAi;
  if (stored.status !== "ok" || !stored.output || !verification) {
    const reason =
      stored.status === "refusal"
        ? "The model declined to answer."
        : stored.status === "max_tokens"
          ? "The answer was cut off before it finished."
          : stored.status === "invalid_output"
            ? "The answer did not match the schema, so it was discarded."
            : "The API call failed.";
    return (
      <p className={styles.muted}>
        {reason} The rules treat this lead as if it had no message. ({stored.error ?? stored.status}
        )
      </p>
    );
  }
  const output = stored.output;
  const rows: Array<[string, string]> = [
    ["Intent", INTENT_LABELS[output.intent]],
    ["Timeline", TIMELINE_LABELS[output.timeline]],
    ["Budget", BUDGET_LABELS[output.budget]],
    ["Next step", NEXT_STEP_LABELS[output.requested_next_step]],
    ["Pain points", output.pain_points.map((p) => PAIN_POINT_LABELS[p]).join(", ") || "None"],
    ["Language", LANGUAGE_LABELS[output.language]],
    ["Tried to instruct the AI", output.injection_attempt ? "Yes" : "No"],
    [
      "Confidence",
      verification.downgraded
        ? `${verification.reportedConfidence} reported, lowered to low by the quote check`
        : output.confidence,
    ],
  ];
  return (
    <div className={styles.ai}>
      <p className={styles.provenance}>
        <span className="tag" data-kind="ai">
          AI output
        </span>{" "}
        Stored from a {model} run on {formatDate(generatedAt)}. Not generated live.
      </p>
      <dl className={styles.pairs}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {output.summary ? <p className={styles.summary}>“{output.summary}”</p> : null}
      <div className={styles.checks}>
        <p className={styles.checksTitle}>Checks before the rules may use it</p>
        <ul>
          <li data-ok="true">Matches the schema</li>
          <li data-ok={verification.unverifiedQuotes.length === 0}>
            {verification.unverifiedQuotes.length === 0
              ? "Every quote appears in the message"
              : `Quotes not found in the message: ${verification.unverifiedQuotes.map((q) => `“${q}”`).join(", ")}`}
          </li>
          <li data-ok={verification.unsupportedFields.length === 0}>
            {verification.unsupportedFields.length === 0
              ? "Every field that adds points has a quote"
              : `No quote for: ${verification.unsupportedFields.join(", ").replace(/_/g, " ")}`}
          </li>
        </ul>
      </div>
    </div>
  );
}

const CHECK_TITLES = new Set(DATA_RULES.map((rule) => rule.check));

/** When every eligibility check passed, one line says so instead of five. */
function compactTrace(steps: TraceStep[]): TraceStep[] {
  const checks = steps.filter((step) => CHECK_TITLES.has(step.title));
  if (checks.length !== DATA_RULES.length || checks.some((step) => step.outcome !== "pass")) {
    return steps;
  }
  const names = DATA_RULES.map((rule) => rule.check.toLowerCase());
  return [
    {
      title: "Eligibility checks",
      detail: `Passed all ${names.length}: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}.`,
      outcome: "pass",
    },
    ...steps.filter((step) => !CHECK_TITLES.has(step.title)),
  ];
}

export function CaseFile({
  leadId,
  data,
  decisions,
  settings,
  aiByLead,
  onClose,
  onNavigate,
}: CaseFileProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLElement>(null);
  const lead = leadId ? data.leadById.get(leadId) : undefined;
  const decision = useMemo(() => decisions.find((d) => d.leadId === leadId), [decisions, leadId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lead && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
    if (!lead && dialog.open) dialog.close();
  }, [lead]);

  // Moving to another lead starts at the top of its file.
  useEffect(() => {
    if (leadId) bodyRef.current?.scrollTo({ top: 0 });
  }, [leadId]);

  const sameLane = useMemo(() => {
    if (!decision) return [];
    return decisions
      .filter((d) => d.lane === decision.lane)
      .sort((a, b) =>
        decision.lane === "sales"
          ? (a.queuePosition ?? 0) - (b.queuePosition ?? 0)
          : b.score.total - a.score.total || a.leadId.localeCompare(b.leadId),
      );
  }, [decisions, decision]);

  if (!lead || !decision) {
    return (
      <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-label="Case file" />
    );
  }

  const ai = aiByLead.get(lead.leadId) ?? null;
  const queueLength = decisions.filter((d) => d.lane === "sales").length;
  const steps = compactTrace(traceDecision(lead, ai, settings, decision, queueLength));
  const need = leadHasNeed(lead.leadId, data.labelIndex);
  const people = data.labelIndex.peopleByLead.get(lead.leadId) ?? [];
  const truth = people
    .map((id) => data.labels.people.find((p) => p.personId === id))
    .filter(Boolean);
  const position = sameLane.findIndex((d) => d.leadId === lead.leadId);
  const previous = sameLane[position - 1];
  const next = sameLane[position + 1];
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Name missing";
  const company = lead.match?.company.name ?? lead.companyName ?? "Company unknown";
  const laneLabel =
    decision.lane === "sales"
      ? decision.called
        ? "Sales now · called"
        : "Sales now · over capacity"
      : LANE_LABELS[decision.lane];
  const fitLines = decision.score.lines.filter((line) => line.group === "fit");
  const intentLines = decision.score.lines.filter((line) => line.group === "intent");
  const aiLines = decision.score.lines.filter((line) => line.group === "ai");
  const usesAnswerKey = settings.extraction === "answer_key";
  const noAiPoints = whyNoAiPoints(lead, ai, settings, decision);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a click on the backdrop is a pointer shortcut; Escape closes the dialog from the keyboard
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      aria-labelledby="case-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">
              Case file · {lead.leadId} · {data.week.label}
            </p>
            <h2 id="case-title" className={styles.title}>
              {name} <span className={styles.titleCompany}>· {company}</span>
            </h2>
            <p className={styles.decision} data-lane={decision.lane}>
              <span className={styles.lanePill}>{laneLabel}</span>
              <span>{REASONS[decision.reason]}</span>
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className="button"
              data-variant="quiet"
              disabled={!previous}
              onClick={() => previous && onNavigate(previous.leadId)}
              aria-label="Previous lead in this lane"
            >
              ←
            </button>
            <button
              type="button"
              className="button"
              data-variant="quiet"
              disabled={!next}
              onClick={() => next && onNavigate(next.leadId)}
              aria-label="Next lead in this lane"
            >
              →
            </button>
            <button
              type="button"
              className="button"
              onClick={() => dialogRef.current?.close()}
              ref={closeRef}
            >
              Close
            </button>
          </div>
        </header>

        <section
          className={styles.body}
          ref={bodyRef}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the case file scrolls, so it needs a tab stop
          tabIndex={0}
          aria-label="Case details"
        >
          <Section title="How the rules decided">
            <ol className={styles.trace}>
              {steps.map((step) => (
                <li key={step.title} data-outcome={step.outcome}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  <span className={styles.stepDetail}>
                    {step.detail}
                    {step.outcome === "stop" && step.lane ? ` → ${LANE_LABELS[step.lane]}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            title="Score"
            aside={
              <p className={styles.scoreTotal}>
                <span className="num">{decision.score.total}</span> / 100
              </p>
            }
          >
            <table className={styles.scoreTable}>
              <tbody>
                {[
                  {
                    name: "Fit",
                    lines: fitLines,
                    total: decision.score.groups.fit,
                    weight: settings.weights.fit,
                  },
                  {
                    name: "Intent",
                    lines: intentLines,
                    total: decision.score.groups.intent,
                    weight: settings.weights.intent,
                  },
                  {
                    name: "AI",
                    lines: aiLines,
                    total: decision.score.groups.ai,
                    weight: settings.weights.ai,
                  },
                ].map((group) => (
                  <ScoreGroupRows key={group.name} {...group} />
                ))}
              </tbody>
            </table>
            {noAiPoints ? <p className={styles.muted}>{NO_AI_POINTS[noAiPoints]}</p> : null}
          </Section>

          <Section
            title={lead.messages.length === 1 ? "Message" : `Messages (${lead.messages.length})`}
          >
            {lead.messages.length === 0 ? (
              <p className={styles.muted}>This lead left no message, so AI has nothing to read.</p>
            ) : (
              lead.messages.map((message) => {
                const messageAi = data.aiIndex?.byMessage.get(message.rawId);
                const quotes =
                  messageAi?.stored.output?.evidence
                    .map((e) => e.quote)
                    .filter((quote) => quoteAppearsIn(quote, message.text)) ?? [];
                const raw = data.rawById.get(message.rawId);
                return (
                  <div key={message.rawId} className={styles.messageBlock}>
                    <p className={styles.meta}>
                      {message.rawId} · {raw ? SOURCE_LABELS[raw.source] : ""} ·{" "}
                      {formatDateTime(message.receivedAt)}
                    </p>
                    <HighlightedMessage text={message.text} quotes={quotes} />
                    {usesAnswerKey ? (
                      <p className={styles.muted}>
                        <span className="tag" data-kind="key">
                          answer key
                        </span>{" "}
                        The lab is using the answer key instead of AI output, as an upper bound.
                      </p>
                    ) : data.aiRun ? (
                      <AiOutput
                        messageAi={messageAi}
                        model={data.aiRun.model}
                        generatedAt={data.aiRun.generatedAt}
                      />
                    ) : (
                      <p className={styles.muted}>
                        AI outputs for this week have not been generated yet. When they are, they
                        are stored with the model name and date and shown here.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </Section>

          <Section title="Data: from the form to the lead">
            <RecordsTable leadId={lead.leadId} data={data} />
            {lead.merges.length > 0 ? (
              <div className={styles.notes}>
                <p className={styles.notesTitle}>Merged submissions</p>
                <ul>
                  {lead.merges.map((link) => (
                    <li key={`${link.a}-${link.b}`}>
                      <code>{link.rule}</code> {link.a} + {link.b}: {link.reason}
                    </li>
                  ))}
                </ul>
                <p className={styles.notesTitle}>Which submission each field came from</p>
                <ul>
                  {lead.survivorship.map((note) => (
                    <li key={note.field}>
                      {note.field}: {note.rule}
                      {note.rawId ? ` (${note.rawId})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {lead.flags.length > 0 ? (
              <div className={styles.notes}>
                <p className={styles.notesTitle}>Possible duplicates, deliberately kept separate</p>
                <ul>
                  {lead.flags.map((flag) => (
                    <li key={`${flag.a}-${flag.b}`}>
                      <code>{flag.rule === "M3_SIMILAR_NAME" ? "M3" : "M2"}</code> {flag.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <dl className={styles.pairs}>
              <div>
                <dt>Company match</dt>
                <dd>
                  {lead.match
                    ? `${lead.match.company.name} (${MATCH_METHOD_LABELS[lead.match.method].toLowerCase()}: ${lead.match.value})`
                    : "No match in the company data"}
                </dd>
              </div>
              <div>
                <dt>Industry</dt>
                <dd>{lead.match ? INDUSTRY_LABELS[lead.match.company.industry] : "Unknown"}</dd>
              </div>
              <div>
                <dt>Company size</dt>
                <dd>{lead.match ? SIZE_LABELS[lead.match.company.sizeBand] : "Unknown"}</dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>
                  {countryName(lead.country) ?? "Unknown"}
                  {lead.countryFilledFromCompany ? " (filled from the company data)" : ""}
                </dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{lead.region ? REGION_LABELS[lead.region] : "Unknown"}</dd>
              </div>
              <div>
                <dt>Web activity, last 30 days</dt>
                <dd>
                  {plural(lead.activity.pricingPageViews, "pricing view")},{" "}
                  {plural(lead.activity.docsVisits, "docs visit")},{" "}
                  {plural(lead.activity.emailClicks, "email click")}
                  {lead.activity.webinarAttended ? ", attended a webinar" : ""}
                  {lead.activity.lastActivityDaysAgo === null
                    ? "; no recorded activity"
                    : lead.activity.lastActivityDaysAgo === 0
                      ? "; last active the day they submitted"
                      : `; last active ${plural(lead.activity.lastActivityDaysAgo, "day")} before submitting`}
                </dd>
              </div>
            </dl>
          </Section>

          <Section
            title="Answer key"
            aside={
              <span className="tag" data-kind="key">
                hidden from the rules
              </span>
            }
          >
            <p className={styles.answer}>
              {need
                ? "This lead had a real need this week."
                : "This lead had no real need this week."}{" "}
              {truth.length > 1
                ? `It merges ${truth.length} different people, which is a false merge.`
                : ""}
            </p>
            <p className={styles.muted}>
              The generator decided this before it wrote the messy records. The rules never read it;
              the lab uses it only to score the outcome.
              {truth[0]
                ? ` Persona: ${truth[0].persona.replace(/_/g, " ")}${truth[0].stage ? `, stage: ${truth[0].stage.replace(/_/g, " ")}` : ""}.`
                : ""}
            </p>
          </Section>
        </section>
      </div>
    </dialog>
  );
}

function ScoreGroupRows({
  name,
  lines,
  total,
  weight,
}: {
  name: string;
  lines: Array<{ label: string; points: number }>;
  total: number;
  weight: number;
}) {
  return (
    <>
      <tr className={styles.groupRow}>
        <th scope="rowgroup">{name}</th>
        <td className="num">
          {total}
          {weight !== 1 ? ` × ${weight.toFixed(1)}` : ""}
        </td>
      </tr>
      {lines.length === 0 ? (
        <tr>
          <td className={styles.muted}>No points</td>
          <td />
        </tr>
      ) : (
        lines.map((line) => (
          <tr key={line.label}>
            <td>{line.label}</td>
            <td className="num">{line.points === 0 ? "0" : signed(line.points)}</td>
          </tr>
        ))
      )}
    </>
  );
}

function RecordsTable({ leadId, data }: { leadId: string; data: WeekData }) {
  const lead = data.leadById.get(leadId);
  if (!lead) return null;
  const fields: Array<{
    key: "firstName" | "lastName" | "email" | "companyName" | "website" | "country" | "jobTitle";
    label: string;
  }> = [
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "email", label: "Email" },
    { key: "companyName", label: "Company" },
    { key: "website", label: "Website" },
    { key: "country", label: "Country" },
    { key: "jobTitle", label: "Job title" },
  ];
  return (
    <div className={styles.records}>
      {lead.rawIds.map((rawId) => {
        const raw = data.rawById.get(rawId);
        const record = data.recordById.get(rawId);
        if (!raw || !record) return null;
        const cleaned: Record<string, string | null> = {
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email,
          companyName: record.companyName,
          website: record.websiteDomain,
          country: record.country,
          jobTitle: record.jobTitle,
        };
        return (
          <div key={rawId} className={styles.recordBlock}>
            <p className={styles.meta}>
              {rawId} · {SOURCE_LABELS[raw.source]} · {formatDateTime(raw.receivedAt)}
            </p>
            <div className={styles.tableScroll}>
              <table className={styles.recordTable}>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">As typed</th>
                    <th scope="col">After cleaning</th>
                    <th scope="col">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => {
                    const change = record.changes.find((c) => c.field === field.key);
                    const before = raw[field.key];
                    return (
                      <tr key={field.key} data-changed={change ? "true" : undefined}>
                        <th scope="row">{field.label}</th>
                        <td>
                          <code>{before === null ? "∅" : JSON.stringify(before)}</code>
                        </td>
                        <td>
                          <code>{cleaned[field.key] === null ? "∅" : cleaned[field.key]}</code>
                        </td>
                        <td>{change?.reason ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
