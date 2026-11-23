"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { OWNERS, SAMPLE_LEADS, type SampleLead } from "@/content/agent/leads";
import { RECORDINGS, type RecordedRun } from "@/content/agent/recordings";
import type { Triage } from "@/core/agent/contract";
import { TEAM } from "@/core/gtm/model";
import styles from "./AgentDemo.module.css";
import { formatHours } from "./format";

/** What handling a lead by hand looks like, to compare with the agent. */
export interface AgentWorth {
  /** Hours until a first reply when leads are handled by hand: a published average. */
  manualWaitHours: number;
}

interface Failure {
  ok: false;
  message: string;
}

type Source = "recorded" | "live";

type State =
  | { kind: "idle" }
  | { kind: "running"; step: number }
  | { kind: "done"; run: RecordedRun; source: Source }
  | { kind: "error"; message: string };

interface LogEntry {
  at: string;
  decision: "Approved" | "Rejected";
  who: string;
  owner: string;
  edited: boolean;
}

const OWN = "own";

const STEPS = [
  "Reading the message",
  "Checking the CRM record",
  "Scoring the fit",
  "Choosing the owner",
  "Drafting the reply",
];

const INTENT: Record<Triage["intent"], string> = {
  demo_request: "Wants a demo",
  pricing_question: "Asks about price",
  security_or_procurement: "Security or procurement",
  support_issue: "Existing customer with a problem",
  not_a_fit: "Not a fit",
  other: "Other",
};

const URGENCY: Record<Triage["urgency"], string> = {
  today: "Act today",
  this_week: "This week",
  no_rush: "No rush",
};

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function AgentDemo({ worth }: { worth: AgentWorth }) {
  const [selected, setSelected] = useState<string>(SAMPLE_LEADS[0]?.id ?? OWN);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [decided, setDecided] = useState<LogEntry["decision"] | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [own, setOwn] = useState({ name: "", company: "", message: "" });
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  const lead: SampleLead | null = SAMPLE_LEADS.find((item) => item.id === selected) ?? null;

  const reset = () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    setState({ kind: "idle" });
    setDecided(null);
  };

  const pick = (id: string) => {
    setSelected(id);
    reset();
  };

  const show = (run: RecordedRun, source: Source) => {
    setSubject(run.triage.reply.subject);
    setBody(run.triage.reply.body);
    setState({ kind: "done", run, source });
  };

  const replay = (run: RecordedRun) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pace = reduce ? 0 : 450;
    setState({ kind: "running", step: 0 });
    STEPS.forEach((_, index) => {
      timers.current.push(
        window.setTimeout(() => setState({ kind: "running", step: index + 1 }), pace * (index + 1)),
      );
    });
    timers.current.push(window.setTimeout(() => show(run, "recorded"), pace * (STEPS.length + 1)));
  };

  const runLive = async (payload: { name?: string; company?: string; message: string }) => {
    setState({ kind: "running", step: 0 });
    const started = Date.now();
    const ticker = window.setInterval(() => {
      const step = Math.min(STEPS.length - 1, Math.floor((Date.now() - started) / 1500));
      setState((current) => (current.kind === "running" ? { kind: "running", step } : current));
    }, 300);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ({ ok: true } & RecordedRun) | Failure;
      if (!data.ok) {
        setState({ kind: "error", message: data.message });
        return;
      }
      show(data, "live");
    } catch {
      setState({ kind: "error", message: "The agent could not be reached. Try again later." });
    } finally {
      window.clearInterval(ticker);
    }
  };

  const handle = () => {
    if (!lead) return;
    setDecided(null);
    const recorded = RECORDINGS.runs[lead.id];
    if (recorded) replay(recorded);
    else void runLive(lead);
  };

  const submitOwn = (event: FormEvent) => {
    event.preventDefault();
    setDecided(null);
    void runLive(own);
  };

  const decide = (decision: LogEntry["decision"]) => {
    if (state.kind !== "done") return;
    const reply = state.run.triage.reply;
    setDecided(decision);
    setLog((previous) => [
      {
        at: now(),
        decision,
        who: lead ? `${lead.name}, ${lead.company}` : own.company || own.name || "Your lead",
        owner: OWNERS[state.run.triage.route.owner].name,
        edited: subject !== reply.subject || body !== reply.body,
      },
      ...previous,
    ]);
  };

  const recordedOn = RECORDINGS.recordedAt
    ? new Date(RECORDINGS.recordedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.inbox}>
        <p className={styles.inboxHead}>
          <span className="eyebrow">Inbox</span>
          <span className={styles.small}>{SAMPLE_LEADS.length} new leads, this morning</span>
        </p>
        <ul className={styles.leadList}>
          {SAMPLE_LEADS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.leadButton}
                aria-pressed={selected === item.id}
                onClick={() => pick(item.id)}
              >
                <span className={styles.leadTop}>
                  <strong>{item.name}</strong>
                  <span className="num">{item.arrived}</span>
                </span>
                <span className={styles.leadCompany}>
                  {item.role}, {item.company}
                </span>
                <span className={styles.leadPreview}>{item.message}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={`${styles.leadButton} ${styles.ownButton}`}
              aria-pressed={selected === OWN}
              onClick={() => pick(OWN)}
            >
              <strong>Write your own lead</strong>
              <span className={styles.leadPreview}>
                Pretend to be a prospect and see a live run.
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div className={styles.work}>
        {lead ? (
          <article className={styles.leadCard} aria-label="The lead">
            <p className={styles.leadMeta}>
              <strong>{lead.name}</strong>, {lead.role} at {lead.company}
              <span className="num"> · arrived {lead.arrived}</span>
            </p>
            <p className={styles.record}>
              <span className={styles.label}>CRM record:</span> {lead.record}
            </p>
            <blockquote className={styles.message}>{lead.message}</blockquote>
            {state.kind === "idle" ? (
              <div className={styles.go}>
                <button type="button" className="button" data-variant="primary" onClick={handle}>
                  Let the agent handle it
                </button>
                <p className={styles.small}>
                  By hand: about {TEAM.manualMinutes} minutes of a rep's time, and the average
                  company replies after {formatHours(worth.manualWaitHours)}.
                </p>
              </div>
            ) : null}
          </article>
        ) : (
          <form className={styles.leadCard} onSubmit={submitOwn}>
            <p className={styles.leadMeta}>
              <strong>Write a lead as a prospect would.</strong> In English or Spanish; the agent
              answers in the same language.
            </p>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Your name (optional)</span>
                <input
                  value={own.name}
                  onChange={(event) => setOwn({ ...own, name: event.target.value })}
                  maxLength={60}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Company (optional)</span>
                <input
                  value={own.company}
                  onChange={(event) => setOwn({ ...own, company: event.target.value })}
                  maxLength={80}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span className={styles.label}>Message</span>
              <textarea
                value={own.message}
                onChange={(event) => setOwn({ ...own, message: event.target.value })}
                placeholder="For example: we have 30 reps on Salesforce and deals go quiet without anyone noticing. Can we see a demo next week?"
                minLength={15}
                maxLength={600}
                rows={4}
                required
              />
            </label>
            <div className={styles.go}>
              <button
                type="submit"
                className="button"
                data-variant="primary"
                disabled={state.kind === "running"}
              >
                Run the agent live
              </button>
              <p className={styles.small}>
                A real call to the Claude API, about 2 US cents. Five runs an hour per visitor.
                Nothing is ever sent.
              </p>
            </div>
          </form>
        )}

        <div className={styles.output} aria-live="polite">
          {state.kind === "running" ? (
            <ol className={styles.progress} aria-label="Agent progress">
              {STEPS.map((label, index) => (
                <li
                  key={label}
                  data-state={
                    index < state.step ? "done" : index === state.step ? "active" : "waiting"
                  }
                >
                  {label}
                </li>
              ))}
            </ol>
          ) : null}

          {state.kind === "error" ? <p className={styles.error}>{state.message}</p> : null}

          {state.kind === "done" ? (
            <article className={styles.result} aria-label="What the agent did">
              <ul className={styles.tags} aria-label="Triage">
                <li>{INTENT[state.run.triage.intent]}</li>
                <li data-urgent={state.run.triage.urgency === "today" || undefined}>
                  {URGENCY[state.run.triage.urgency]}
                </li>
                <li className="num">Fit {state.run.triage.fit.score}/100</li>
              </ul>
              <p className={styles.reason}>{state.run.triage.fit.reason}</p>

              <div className={styles.route}>
                <p className="eyebrow">Routed to</p>
                <p className={styles.owner}>
                  {OWNERS[state.run.triage.route.owner].name}{" "}
                  <span className={styles.queue}>
                    · {OWNERS[state.run.triage.route.owner].queue}
                  </span>
                </p>
                <p className={styles.reason}>{state.run.triage.route.reason}</p>
              </div>

              <div className={styles.draft}>
                <p className="eyebrow">Reply for the owner to approve</p>
                <label className={styles.field}>
                  <span className={styles.label}>Subject</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={decided !== null}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Message</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={10}
                    disabled={decided !== null}
                  />
                </label>
                {state.run.triage.checks.length ? (
                  <div>
                    <p className={styles.label}>Check before sending</p>
                    <ul className={styles.checks}>
                      {state.run.triage.checks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {decided ? (
                  <p className={styles.decided}>
                    {decided === "Approved"
                      ? "Approved and logged. In a real setup the reply goes out from the owner's inbox and the note lands in the CRM; here nothing is sent."
                      : "Rejected and logged. Rejections are reviewed every week to improve the instructions."}
                  </p>
                ) : (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="button"
                      data-variant="primary"
                      onClick={() => decide("Approved")}
                    >
                      Approve
                    </button>
                    <button type="button" className="button" onClick={() => decide("Rejected")}>
                      Reject
                    </button>
                  </div>
                )}
              </div>

              <p className={styles.crm}>
                <span className={styles.label}>CRM note:</span> {state.run.triage.crm_note}
              </p>

              <dl className={styles.compare}>
                <div>
                  <dt>By hand</dt>
                  <dd>
                    <span className="num">{TEAM.manualMinutes} min</span> of work, first reply after{" "}
                    <span className="num">{formatHours(worth.manualWaitHours)}</span>
                  </dd>
                </div>
                <div data-good>
                  <dt>This agent</dt>
                  <dd>
                    <span className="num">{state.run.seconds} s</span> and{" "}
                    <span className="num">${state.run.costUsd.toFixed(3)}</span>, then about a
                    minute for a person to approve
                  </dd>
                </div>
              </dl>
              <p className={styles.small}>
                {state.source === "recorded"
                  ? `A recorded run of this agent${recordedOn ? ` on ${recordedOn}` : ""}, replayed so it costs nothing to watch.`
                  : "A live run, just now."}{" "}
                Model {state.run.model}; {state.run.usage.inputTokens.toLocaleString("en-US")}{" "}
                tokens in, {state.run.usage.outputTokens.toLocaleString("en-US")} out.
              </p>
            </article>
          ) : null}
        </div>

        {log.length ? (
          <section className={styles.log} aria-label="Approval log">
            <p className="eyebrow">Approval log, this visit</p>
            <ul>
              {log.map((entry) => (
                <li key={`${entry.at}-${entry.who}-${entry.decision}-${entry.edited}`}>
                  <span className="num">{entry.at}</span> {entry.decision}: {entry.who} →{" "}
                  {entry.owner}
                  {entry.edited ? " (edited by a person)" : " (as drafted)"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
