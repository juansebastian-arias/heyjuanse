"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeadAiSignals } from "@/core/ai/signals";
import { type Explanation, explainChange } from "@/core/backtest/explain";
import { leadHasNeed, type Metrics } from "@/core/backtest/metrics";
import { runBacktest } from "@/core/backtest/run";
import type { Decision, Lane } from "@/core/routing/route";
import {
  DEFAULT_SETTINGS,
  type LabSettings,
  LIMITS,
  parseSettings,
  serializeSettings,
  type ViewMode,
} from "@/core/settings";
import { useLabData } from "@/lib/lab/data";
import { useSqlMetrics } from "@/lib/lab/sql";
import { CaseFile } from "./CaseFile";
import styles from "./DecisionLab.module.css";
import { Dials } from "./Dials";
import { HoodPanels } from "./hood/HoodPanels";
import { LaneField } from "./LaneField";
import { LeadTable } from "./LeadTable";
import { MetricsPanel } from "./MetricsPanel";
import { type Experiment, WhatChanged } from "./WhatChanged";

type Display = "marks" | "table";

interface Snapshot {
  settings: LabSettings;
  decisions: Decision[];
  metrics: Metrics;
}

/** A burst of dial movements closer together than this counts as one change. */
const BURST_MS = 700;
const EMPTY_SIGNALS: ReadonlyMap<string, LeadAiSignals> = new Map();

function readAddress(): {
  settings: LabSettings;
  mode: ViewMode;
  display: Display;
  caseId: string | null;
} {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("case");
  return {
    settings: parseSettings(params),
    mode: params.get("view") === "hood" ? "hood" : "explore",
    display: params.get("show") === "table" ? "table" : "marks",
    caseId: caseId && /^L-\d{1,6}$/.test(caseId) ? caseId : null,
  };
}

export function DecisionLab() {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<LabSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<ViewMode>("explore");
  const [display, setDisplay] = useState<Display>("marks");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Snapshot | null>(null);
  /** On narrow screens the rules fold into one line until opened. */
  const [rulesOpen, setRulesOpen] = useState(false);
  const lastChangeAt = useRef(0);

  // Read the page address once, so a shared link opens the same view.
  useEffect(() => {
    const initial = readAddress();
    setSettings(initial.settings);
    setMode(initial.mode);
    setDisplay(initial.display);
    setCaseId(initial.caseId);
    setHydrated(true);
  }, []);

  // Keep the address in sync, without adding history entries.
  useEffect(() => {
    if (!hydrated) return;
    const params = serializeSettings(settings);
    if (mode === "hood") params.set("view", "hood");
    if (display === "table") params.set("show", "table");
    if (caseId) params.set("case", caseId);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [hydrated, settings, mode, display, caseId]);

  const state = useLabData(hydrated ? settings.week : null);
  const data = state.status === "ready" && state.data.week.id === settings.week ? state.data : null;
  const hasModelOutputs = Boolean(data?.aiIndex);

  // AI stays off when there are no stored outputs to read, whatever the address says.
  const effective = useMemo<LabSettings>(
    () =>
      settings.extraction === "model" && !hasModelOutputs
        ? { ...settings, aiPolicy: "off" }
        : settings,
    [settings, hasModelOutputs],
  );

  const aiByLead = useMemo(() => {
    if (!data) return EMPTY_SIGNALS;
    if (effective.extraction === "answer_key") return data.answerKey;
    return data.aiIndex?.byLead ?? EMPTY_SIGNALS;
  }, [data, effective.extraction]);

  const run = useMemo(() => {
    if (!data) return null;
    const started = performance.now();
    const result = runBacktest(data.prepared, aiByLead, data.labelIndex, effective);
    return { ...result, routeMs: performance.now() - started };
  }, [data, aiByLead, effective]);

  const sql = useSqlMetrics(data, run?.decisions ?? null);

  const hasNeed = useCallback(
    (leadId: string) => (data ? leadHasNeed(leadId, data.labelIndex) : false),
    [data],
  );

  const explanation: Explanation | null = useMemo(() => {
    if (!anchor || !run) return null;
    return explainChange({
      before: anchor,
      after: { settings: effective, decisions: run.decisions, metrics: run.metrics },
      hasNeed,
    });
  }, [anchor, run, effective, hasNeed]);

  const highlighted = useMemo(() => new Set(explanation?.movedLeadIds ?? []), [explanation]);

  const update = useCallback(
    (next: LabSettings) => {
      const now = performance.now();
      if (next.week !== settings.week) {
        setAnchor(null);
        setCaseId(null);
      } else if (run && (now - lastChangeAt.current > BURST_MS || !anchor)) {
        setAnchor({ settings: effective, decisions: run.decisions, metrics: run.metrics });
      }
      lastChangeAt.current = now;
      setSettings(next);
    },
    [settings.week, run, anchor, effective],
  );

  const undo = useCallback(() => {
    if (!anchor) return;
    setSettings(anchor.settings);
    setAnchor(null);
    lastChangeAt.current = 0;
  }, [anchor]);

  const experiments = useMemo<Experiment[]>(() => {
    const list: Experiment[] = [];
    const moreCalls = settings.capacity + 15 <= LIMITS.capacity.max;
    list.push({
      id: "capacity",
      label: moreCalls ? "Add 15 sales calls" : "Remove 15 sales calls",
      question: "Do more calls reach more needs, or go further down the queue?",
      apply: () => update({ ...settings, capacity: settings.capacity + (moreCalls ? 15 : -15) }),
    });
    list.push({
      id: "order",
      label:
        settings.queueOrder === "score" ? "Call in order of arrival" : "Call highest score first",
      question: "How much does the score's ordering matter?",
      apply: () =>
        update({
          ...settings,
          queueOrder: settings.queueOrder === "score" ? "arrival" : "score",
        }),
    });
    const lower = settings.threshold - 10 >= LIMITS.threshold.min;
    list.push({
      id: "threshold",
      label: lower ? `Lower the threshold to ${settings.threshold - 10}` : "Raise the threshold",
      question: "Does a lower bar change who gets called when calls are limited?",
      apply: () =>
        update({
          ...settings,
          threshold: lower ? settings.threshold - 10 : settings.threshold + 10,
        }),
    });
    if (effective.aiPolicy === "off") {
      list.push(
        hasModelOutputs
          ? {
              id: "ai",
              label: "Use AI signals",
              question: "Reading the messages: who moves, and who goes to a person?",
              apply: () => update({ ...settings, extraction: "model", aiPolicy: "high" }),
            }
          : {
              id: "ai",
              label: "Try perfect message reading",
              question: "The ceiling for AI here, using the answer key. Not AI output.",
              apply: () => update({ ...settings, extraction: "answer_key", aiPolicy: "high" }),
            },
      );
    }
    return list;
  }, [settings, effective.aiPolicy, hasModelOutputs, update]);

  const emptyText = useCallback(
    (lane: Lane) =>
      lane === "review" && effective.aiPolicy === "off"
        ? "Empty while AI signals are off: only a doubtful AI signal or a prompt injection sends a lead here."
        : "No leads here with these rules.",
    [effective.aiPolicy],
  );

  const modelOutputs =
    data?.aiRun && data.aiIndex
      ? { model: data.aiRun.model, generatedAt: data.aiRun.generatedAt }
      : null;

  return (
    <div className={styles.lab}>
      <header className={`page ${styles.intro}`}>
        <p className="eyebrow">Decision Lab · Larkspur, a fictional company · synthetic data</p>
        <h1 className={styles.title}>Which inbound leads should sales call this week?</h1>
        <p className={styles.lede}>
          Larkspur sells freight-operations software. About 400 people fill in its forms each week,
          with typos, duplicates and the occasional prompt injection. These rules clean them, score
          them and put each one in a lane. Change the rules and see who gets a call, who waits, and
          what it costs. An answer key, hidden from the rules, says who really had a need.
        </p>
        <fieldset className={styles.modes}>
          <legend className="visually-hidden">View</legend>
          <button
            type="button"
            aria-pressed={mode === "explore"}
            onClick={() => setMode("explore")}
          >
            Explore
          </button>
          <button type="button" aria-pressed={mode === "hood"} onClick={() => setMode("hood")}>
            Under the hood
          </button>
        </fieldset>
      </header>

      <div className={`page ${styles.workspace}`}>
        <aside className={styles.controls} aria-label="Rules">
          <button
            type="button"
            className={styles.controlsToggle}
            aria-expanded={rulesOpen}
            aria-controls="lab-rules"
            onClick={() => setRulesOpen((open) => !open)}
          >
            <span className={styles.controlsSummary}>
              <strong>Rules</strong> {settings.capacity} calls · threshold {settings.threshold} · AI{" "}
              {effective.aiPolicy === "off" ? "off" : "on"} ·{" "}
              {settings.queueOrder === "score" ? "by score" : "by arrival"}
            </span>
            <span className={styles.controlsAction}>{rulesOpen ? "Hide" : "Change"}</span>
          </button>
          <div id="lab-rules" className={styles.controlsBody} data-open={rulesOpen || undefined}>
            <Dials
              settings={settings}
              onChange={update}
              weeks={state.status === "ready" ? state.manifest.weeks : []}
              mode={mode}
              modelOutputs={modelOutputs}
              disabled={!data}
            />
          </div>
        </aside>

        <div className={styles.main}>
          {state.status === "error" ? (
            <div className={styles.error} role="alert">
              <p>
                <strong>The lab could not load its data.</strong> {state.message}
              </p>
              <button type="button" className="button" onClick={() => window.location.reload()}>
                Reload the page
              </button>
            </div>
          ) : !data || !run ? (
            <div className={styles.loading} aria-busy="true">
              <p>Loading this week’s leads and running the rules…</p>
            </div>
          ) : (
            <>
              <WhatChanged
                explanation={explanation}
                experiments={experiments}
                onUndo={explanation ? undo : null}
              />
              <MetricsPanel
                metrics={run.metrics}
                decisions={run.decisions}
                baseline={explanation ? (anchor?.metrics ?? null) : null}
                sql={sql}
                expandedByDefault={false}
              />
              <section className={styles.lanes} aria-labelledby="lanes-title">
                <div className={styles.lanesHead}>
                  <div>
                    <h2 id="lanes-title" className={styles.lanesTitle}>
                      Where every lead went
                    </h2>
                    <p className={styles.lanesHint}>
                      {display === "marks" ? "One mark" : "One row"} per lead, after cleaning and
                      merging duplicates. Open any lead to see why it went there.
                    </p>
                  </div>
                  <fieldset className={styles.displays}>
                    <legend className="visually-hidden">Show leads as</legend>
                    <button
                      type="button"
                      aria-pressed={display === "marks"}
                      onClick={() => setDisplay("marks")}
                    >
                      Marks
                    </button>
                    <button
                      type="button"
                      aria-pressed={display === "table"}
                      onClick={() => setDisplay("table")}
                    >
                      Table
                    </button>
                  </fieldset>
                </div>
                {display === "marks" ? (
                  <LaneField
                    data={data}
                    decisions={run.decisions}
                    capacity={effective.capacity}
                    highlighted={highlighted}
                    selectedId={caseId}
                    showDescriptions
                    emptyText={emptyText}
                    onOpen={setCaseId}
                  />
                ) : (
                  <LeadTable
                    data={data}
                    decisions={run.decisions}
                    highlighted={highlighted}
                    onOpen={setCaseId}
                  />
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {data && run ? (
        mode === "hood" ? (
          <HoodPanels
            data={data}
            decisions={run.decisions}
            settings={effective}
            sql={sql}
            routeMs={run.routeMs}
            onOpen={setCaseId}
          />
        ) : (
          <aside className={`page ${styles.teaser}`} aria-label="More detail">
            <p>
              Want the SQL, the data quality report, the score calibration and the AI scorecard?{" "}
              <button type="button" className={styles.linkButton} onClick={() => setMode("hood")}>
                Switch to the under-the-hood view
              </button>{" "}
              or read <a href="/architecture">how it is built</a>.
            </p>
          </aside>
        )
      ) : null}

      {data && run ? (
        <CaseFile
          leadId={caseId}
          data={data}
          decisions={run.decisions}
          settings={effective}
          aiByLead={aiByLead}
          onClose={() => setCaseId(null)}
          onNavigate={setCaseId}
        />
      ) : null}
    </div>
  );
}
