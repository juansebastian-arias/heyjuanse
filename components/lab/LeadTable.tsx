"use client";

import { useId, useMemo, useState } from "react";
import { leadHasNeed } from "@/core/backtest/metrics";
import { type Decision, LANE_LABELS, LANES, type Lane, REASONS } from "@/core/routing/route";
import type { WeekData } from "@/lib/lab/data";
import styles from "./LeadTable.module.css";

type SortKey = "lane" | "score" | "arrival";

const SORT_LABELS: Record<SortKey, string> = {
  lane: "Lane, then queue and score",
  score: "Score, highest first",
  arrival: "Arrival, earliest first",
};

interface LeadTableProps {
  data: WeekData;
  decisions: Decision[];
  highlighted: ReadonlySet<string>;
  onOpen: (leadId: string) => void;
}

function laneText(decision: Decision): string {
  if (decision.lane !== "sales") return LANE_LABELS[decision.lane];
  return decision.called ? "Sales now · called" : "Sales now · over capacity";
}

export function LeadTable({ data, decisions, highlighted, onOpen }: LeadTableProps) {
  const [lane, setLane] = useState<Lane | "all">("all");
  const [sort, setSort] = useState<SortKey>("lane");
  const laneId = useId();
  const sortId = useId();

  const rows = useMemo(() => {
    const laneIndex = (value: Lane) => LANES.indexOf(value);
    const filtered = decisions.filter((d) => lane === "all" || d.lane === lane);
    const arrival = (d: Decision) => data.leadById.get(d.leadId)?.firstTouchAt ?? "";
    return [...filtered].sort((a, b) => {
      if (sort === "score")
        return b.score.total - a.score.total || a.leadId.localeCompare(b.leadId);
      if (sort === "arrival") return arrival(a).localeCompare(arrival(b));
      return (
        laneIndex(a.lane) - laneIndex(b.lane) ||
        (a.queuePosition ?? 0) - (b.queuePosition ?? 0) ||
        b.score.total - a.score.total ||
        a.leadId.localeCompare(b.leadId)
      );
    });
  }, [decisions, lane, sort, data.leadById]);

  const counts = useMemo(() => {
    const result = new Map<Lane, number>();
    for (const decision of decisions)
      result.set(decision.lane, (result.get(decision.lane) ?? 0) + 1);
    return result;
  }, [decisions]);

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <div className={styles.control}>
          <label htmlFor={laneId}>Lane</label>
          <select
            id={laneId}
            value={lane}
            onChange={(event) => setLane(event.target.value as Lane | "all")}
          >
            <option value="all">All lanes ({decisions.length})</option>
            {LANES.map((value) => (
              <option key={value} value={value}>
                {LANE_LABELS[value]} ({counts.get(value) ?? 0})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.control}>
          <label htmlFor={sortId}>Sort by</label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="visually-hidden">
            {rows.length} leads, {lane === "all" ? "all lanes" : LANE_LABELS[lane]}, sorted by{" "}
            {SORT_LABELS[sort].toLowerCase()}. The last column comes from the answer key, which the
            rules never read.
          </caption>
          <thead>
            <tr>
              <th scope="col">Lead</th>
              <th scope="col">Person and company</th>
              <th scope="col">Lane</th>
              <th scope="col">Why</th>
              <th scope="col" className={styles.numeric}>
                Queue
              </th>
              <th scope="col" className={styles.numeric}>
                Score
              </th>
              <th scope="col">Real need</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((decision) => {
              const lead = data.leadById.get(decision.leadId);
              const name =
                [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || "Name missing";
              const company = lead?.match?.company.name ?? lead?.companyName ?? "Company unknown";
              const need = leadHasNeed(decision.leadId, data.labelIndex);
              return (
                <tr
                  key={decision.leadId}
                  data-lane={decision.lane}
                  data-highlight={highlighted.has(decision.leadId) || undefined}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className={styles.open}
                      onClick={() => onOpen(decision.leadId)}
                      aria-label={`Open case file for ${decision.leadId}, ${name}`}
                    >
                      {decision.leadId}
                    </button>
                  </th>
                  <td>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.company}>{company}</span>
                  </td>
                  <td>
                    <span className={styles.lane}>
                      <span className={styles.swatch} aria-hidden="true" />
                      {laneText(decision)}
                    </span>
                  </td>
                  <td className={styles.reason}>{REASONS[decision.reason]}</td>
                  <td className={`num ${styles.numeric}`}>{decision.queuePosition ?? "–"}</td>
                  <td className={`num ${styles.numeric}`}>{decision.score.total}</td>
                  <td>{need ? "Yes" : "No"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
