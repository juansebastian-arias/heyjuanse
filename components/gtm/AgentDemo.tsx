"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { Research } from "@/core/agent/contract";
import styles from "./AgentDemo.module.css";

interface Success {
  ok: true;
  research: Research;
  removedSignals: number;
  searches: { url: string; title: string }[];
  usage: { inputTokens: number; outputTokens: number; searches: number };
  costUsd: number;
  seconds: number;
  model: string;
}

interface Failure {
  ok: false;
  error: string;
  message: string;
}

type State =
  | { kind: "idle" }
  | { kind: "running"; since: number }
  | { kind: "done"; result: Success }
  | { kind: "error"; message: string };

interface LogEntry {
  at: string;
  decision: "Approved" | "Rejected";
  company: string;
  edited: boolean;
}

const STEPS = [
  "Searching the web",
  "Reading what it found",
  "Scoring the fit",
  "Drafting the message",
];

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function AgentDemo() {
  const [company, setCompany] = useState("");
  const [offer, setOffer] = useState(
    "Automation that routes inbound leads to the right rep in minutes and drafts the first email.",
  );
  const [state, setState] = useState<State>({ kind: "idle" });
  const [tick, setTick] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [decided, setDecided] = useState<LogEntry["decision"] | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (state.kind !== "running") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state.kind]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ kind: "running", since: Date.now() });
    setTick(0);
    setDecided(null);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, offer }),
      });
      const data = (await response.json()) as Success | Failure;
      if (!data.ok) {
        setState({ kind: "error", message: data.message });
        return;
      }
      setSubject(data.research.first_message.subject);
      setBody(data.research.first_message.body);
      setState({ kind: "done", result: data });
    } catch {
      setState({ kind: "error", message: "The agent could not be reached. Try again later." });
    }
  };

  const decide = (decision: LogEntry["decision"]) => {
    if (state.kind !== "done") return;
    const draft = state.result.research.first_message;
    setDecided(decision);
    setLog((prev) => [
      {
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        decision,
        company,
        edited: subject !== draft.subject || body !== draft.body,
      },
      ...prev,
    ]);
  };

  const step = Math.min(STEPS.length - 1, Math.floor(tick / 5));

  return (
    <div className={styles.wrap}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>A real company to research</span>
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="For example, a software company you know"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>What you sell, in one sentence</span>
          <textarea
            value={offer}
            onChange={(event) => setOffer(event.target.value)}
            minLength={10}
            maxLength={240}
            rows={3}
            required
          />
        </label>
        <button
          type="submit"
          className="button"
          data-variant="primary"
          disabled={state.kind === "running"}
        >
          {state.kind === "running" ? "Researching…" : "Research and draft"}
        </button>
        <p className={styles.small}>
          Uses live web search and the Claude API. At most three searches per run and three runs an
          hour per visitor. Nothing is ever sent.
        </p>
      </form>

      <div className={styles.output} aria-live="polite">
        {state.kind === "idle" ? (
          <div className={styles.placeholder}>
            <p className={styles.headline}>An AI agent does the research. A person decides.</p>
            <ol className={styles.howList}>
              <li>It searches the web for the company and reads what it finds.</li>
              <li>It writes a short brief where every fact links to its source.</li>
              <li>It scores the fit with what you sell and drafts a first message.</li>
              <li>You edit the draft and approve or reject it. The decision is logged.</li>
            </ol>
          </div>
        ) : null}

        {state.kind === "running" ? (
          <ol className={styles.progress} aria-label="Agent progress">
            {STEPS.map((label, index) => (
              <li
                key={label}
                data-state={index < step ? "done" : index === step ? "active" : "waiting"}
              >
                {label}
              </li>
            ))}
          </ol>
        ) : null}

        {state.kind === "error" ? <p className={styles.error}>{state.message}</p> : null}

        {state.kind === "done" ? (
          <article className={styles.result}>
            <header className={styles.resultHead}>
              <p className="eyebrow">Brief</p>
              <p className={`num ${styles.score}`} title="Fit score from 0 to 100">
                Fit {state.result.research.fit.score}/100
              </p>
            </header>
            <p className={styles.summary}>{state.result.research.company_summary}</p>
            {state.result.research.signals.length ? (
              <ul className={styles.signals}>
                {state.result.research.signals.map((signal) => (
                  <li key={signal.source_url + signal.finding}>
                    {signal.finding}{" "}
                    <a href={signal.source_url} rel="noopener noreferrer nofollow" target="_blank">
                      {host(signal.source_url)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.small}>No signal with a verifiable source was found.</p>
            )}
            <p className={styles.reason}>
              <strong>Why this score:</strong> {state.result.research.fit.reason}
            </p>

            <div className={styles.draft}>
              <p className="eyebrow">Draft for your approval</p>
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
                  rows={8}
                  disabled={decided !== null}
                />
              </label>
              {state.result.research.open_questions.length ? (
                <div className={styles.questions}>
                  <p className={styles.label}>Check before sending</p>
                  <ul>
                    {state.result.research.open_questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {decided ? (
                <p className={styles.decided}>
                  {decided === "Approved"
                    ? "Approved and logged. In a real setup this goes to the rep's outbox and the CRM records the activity; here nothing is sent."
                    : "Rejected and logged. The reason feeds the next version of the prompt."}
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

            <dl className={styles.stats}>
              <div>
                <dt>Time</dt>
                <dd className="num">{state.result.seconds} s</dd>
              </div>
              <div>
                <dt>Searches</dt>
                <dd className="num">{state.result.usage.searches}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd className="num">
                  {(
                    state.result.usage.inputTokens + state.result.usage.outputTokens
                  ).toLocaleString("en-US")}
                </dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd className="num">${state.result.costUsd.toFixed(3)}</dd>
              </div>
              <div>
                <dt>Unsourced claims removed</dt>
                <dd className="num">{state.result.removedSignals}</dd>
              </div>
            </dl>
          </article>
        ) : null}

        {log.length ? (
          <section className={styles.log} aria-label="Approval log">
            <p className="eyebrow">Approval log, this visit</p>
            <ul>
              {log.map((entry) => (
                <li key={`${entry.at}-${entry.company}-${entry.decision}`}>
                  <span className="num">{entry.at}</span> {entry.decision}: {entry.company}
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
