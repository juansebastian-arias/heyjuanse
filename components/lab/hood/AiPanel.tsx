"use client";

import { useMemo } from "react";
import { AI_POLICY_LABELS, type LeadAiSignals } from "@/core/ai/signals";
import { evaluateRun, SCORED_FIELD_LABELS, SCORED_FIELDS } from "@/core/backtest/ai-eval";
import { runBacktest } from "@/core/backtest/run";
import { CONFIDENCE_LEVELS } from "@/core/model";
import type { LabSettings } from "@/core/settings";
import { formatDate, formatPercent } from "@/lib/format";
import type { WeekData } from "@/lib/lab/data";
import styles from "./Hood.module.css";

const NONE: ReadonlyMap<string, LeadAiSignals> = new Map();

interface AiPanelProps {
  data: WeekData;
  settings: LabSettings;
  onOpen: (leadId: string) => void;
}

function share(part: number, total: number): string {
  return total === 0 ? "–" : formatPercent(part / total);
}

export function AiPanel({ data, settings, onOpen }: AiPanelProps) {
  const scorecard = useMemo(
    () =>
      data.aiRun && !data.aiStale ? evaluateRun(data.aiRun, data.labels, data.leadsFile) : null,
    [data],
  );

  // The same week and dials, three ways: without AI, with the stored model output, and with
  // the answer key standing in for perfect extraction.
  const comparison = useMemo(() => {
    const policy = settings.aiPolicy === "off" ? "high" : settings.aiPolicy;
    const base = { ...settings };
    const off = runBacktest(data.prepared, NONE, data.labelIndex, { ...base, aiPolicy: "off" });
    const model = data.aiIndex
      ? runBacktest(data.prepared, data.aiIndex.byLead, data.labelIndex, {
          ...base,
          aiPolicy: policy,
        })
      : null;
    const perfect = runBacktest(data.prepared, data.answerKey, data.labelIndex, {
      ...base,
      aiPolicy: "high",
    });
    return { off, model, perfect, policy };
  }, [data, settings]);

  const leadForRaw = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of data.prepared.leads)
      for (const rawId of lead.rawIds) map.set(rawId, lead.leadId);
    return map;
  }, [data.prepared.leads]);

  const rows = [
    { label: "AI off", result: comparison.off },
    comparison.model && data.aiRun
      ? {
          label: `Stored ${data.aiRun.model} output, ${AI_POLICY_LABELS[comparison.policy].toLowerCase()}`,
          result: comparison.model,
        }
      : null,
    { label: "Answer key (perfect extraction, an upper bound)", result: comparison.perfect },
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <section className={styles.panel} aria-labelledby="ai-panel-title" id="ai">
      <div className={styles.panelHead}>
        <h3 id="ai-panel-title">AI: what it reads, and how good it is</h3>
        <p>
          A model reads each message once, offline, and the answers are stored with the model name
          and date. The rules use an answer only if it passes the checks and the confidence policy.
          Nothing on this page calls a model.
        </p>
      </div>

      <h4 className={styles.subhead}>Same week, same dials, three ways</h4>
      <div className={styles.resultScroll}>
        <table className={styles.result}>
          <caption className="visually-hidden">
            Needs reached, calls without a need and review cases, with AI off, with stored model
            output, and with the answer key
          </caption>
          <thead>
            <tr>
              <th scope="col">Signals from messages</th>
              <th scope="col">Needs reached</th>
              <th scope="col">Calls without a need</th>
              <th scope="col">Human review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td data-type="number">
                  {row.result.metrics.needsReached} of {row.result.metrics.needsTotal}
                </td>
                <td data-type="number">{row.result.metrics.callsWithoutNeed}</td>
                <td data-type="number">{row.result.metrics.reviewCases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>
        The answer key is what the generator knows about each message. It shows how much reading the
        messages could help here at best. It is never shown as AI output.
      </p>

      {scorecard && data.aiRun ? (
        <>
          <h4 className={styles.subhead}>Scorecard for the stored run</h4>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Model</dt>
              <dd>{scorecard.model}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Run on</dt>
              <dd>{formatDate(scorecard.generatedAt)}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Prompt version</dt>
              <dd className="num">{scorecard.promptVersion}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Cost for the week</dt>
              <dd className="num">${scorecard.usage.estimatedCostUsd.toFixed(3)}</dd>
            </div>
          </dl>
          <div className={styles.resultScroll}>
            <table className={styles.result}>
              <caption className="visually-hidden">
                Accuracy per field against the answer key
              </caption>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Acceptable answers</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {SCORED_FIELDS.map((field) => (
                  <tr key={field}>
                    <th scope="row">{SCORED_FIELD_LABELS[field]}</th>
                    <td data-type="number">
                      {scorecard.fields[field].correct} of {scorecard.fields[field].total}
                    </td>
                    <td data-type="number">
                      {share(scorecard.fields[field].correct, scorecard.fields[field].total)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">All four fields that move the score</th>
                  <td data-type="number">
                    {scorecard.routingFieldsCorrect.correct} of{" "}
                    {scorecard.routingFieldsCorrect.total}
                  </td>
                  <td data-type="number">
                    {share(
                      scorecard.routingFieldsCorrect.correct,
                      scorecard.routingFieldsCorrect.total,
                    )}
                  </td>
                </tr>
                {CONFIDENCE_LEVELS.map((level) => (
                  <tr key={level}>
                    <th scope="row">… when the rules saw {level} confidence</th>
                    <td data-type="number">
                      {scorecard.byConfidence[level].correct} of{" "}
                      {scorecard.byConfidence[level].total}
                    </td>
                    <td data-type="number">
                      {share(
                        scorecard.byConfidence[level].correct,
                        scorecard.byConfidence[level].total,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Prompt injections caught: {scorecard.injection.caught} of {scorecard.injection.total}
            {scorecard.injection.falseAlarms > 0
              ? `, with ${scorecard.injection.falseAlarms} false alarms`
              : ", with no false alarms"}
            . Answers lowered to low confidence by the quote check: {scorecard.downgraded}. Failed
            calls: {scorecard.messages - scorecard.statuses.ok} of {scorecard.messages}.
          </p>
          {scorecard.misses.length > 0 ? (
            <details className={styles.schema}>
              <summary>
                Every miss ({scorecard.misses.length}), so you can judge them yourself
              </summary>
              <ul className={styles.misses}>
                {scorecard.misses.map((miss) => {
                  const leadId = leadForRaw.get(miss.rawId);
                  return (
                    <li key={`${miss.rawId}-${miss.field}`}>
                      {leadId ? (
                        <button
                          type="button"
                          className={styles.leadLink}
                          onClick={() => onOpen(leadId)}
                        >
                          {leadId}
                        </button>
                      ) : (
                        miss.rawId
                      )}{" "}
                      <code>{miss.field}</code>: expected <code>{miss.expected}</code>, got{" "}
                      <code>{miss.got}</code>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <div className={styles.pending}>
          <p>
            <strong>
              {data.aiRun && data.aiStale
                ? "The stored AI outputs are out of date."
                : "AI outputs for this week have not been generated yet."}
            </strong>{" "}
            {data.aiRun && data.aiStale
              ? "They were made for a different version of the leads file, so the lab ignores them until the run is repeated."
              : "The extraction script is written and tested against a fake model; it runs from a GitHub workflow that keeps the API key server-side and stops at a cost cap. When it has run, the results are stored with the model name and date, and the scorecard appears here."}
          </p>
        </div>
      )}
    </section>
  );
}
