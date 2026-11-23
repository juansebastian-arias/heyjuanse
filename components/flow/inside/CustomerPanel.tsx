"use client";

import { useId, useMemo, useState } from "react";
import { setupKey } from "@/core/flow/company";
import { assumptionsFor, isChanged, type Scenario, tweaksKey } from "@/core/flow/scenario";
import type { Fate, Pair } from "@/core/flow/trace";
import { money } from "@/lib/flow/format";
import { followedBuyers, MOMENTS, momentText, storyOf } from "@/lib/flow/story";
import styles from "../Inside.module.css";
import { Scroll } from "./Scroll";

const FATE: Record<Fate, string> = {
  paid: "paid",
  left: "gave up",
  exit: "left",
  open: "in progress",
};

/** A customer worth opening on: one who gave up today, better still one the changes kept. */
function pickFirst(pairs: readonly Pair[]): number {
  const saved = pairs.find((pair) => pair.before.fate === "left" && pair.after.fate === "paid");
  const lost = pairs.find((pair) => pair.before.fate === "left");
  return (saved ?? lost ?? pairs[0])?.request.id ?? -1;
}

/** One would-be buyer, followed step by step through today's company and the visitor's version. */
export function CustomerPanel({ scenario }: { scenario: Scenario }) {
  const selectId = useId();
  const setup = setupKey(scenario.setup);
  const assumptions = tweaksKey(scenario.tweaks);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed when the scenario's content changes, not when the object is new
  const pairs = useMemo(
    () => followedBuyers(scenario.setup, assumptionsFor(scenario.tweaks)),
    [setup, assumptions],
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const changed = isChanged(scenario.setup);
  const pair =
    pairs.find((item) => item.request.id === chosen) ??
    pairs.find((item) => item.request.id === pickFirst(pairs)) ??
    null;

  if (!pair) {
    return <p className={styles.note}>No company that would buy wrote in that week.</p>;
  }

  const before = storyOf(pair.before);
  const after = storyOf(pair.after);
  const kept = pairs.filter((item) => item.before.fate === "left" && item.after.fate === "paid");
  const lostToday = pairs.filter((item) => item.before.fate === "left").length;

  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        The averages are made of single customers. These are the {pairs.length} companies that wrote
        in during one week and would buy if nobody made them wait. Today {lostToday} of them give up
        {changed
          ? `; with your changes, ${kept.length} of those ${lostToday} ${kept.length === 1 ? "becomes a customer" : "become customers"}`
          : ""}
        . Chance is settled per customer, so each one behaves the same in both versions and only the
        company differs.
      </p>
      <div className={styles.field}>
        <label htmlFor={selectId}>Customer</label>
        <select
          id={selectId}
          value={pair.request.id}
          onChange={(event) => setChosen(Number(event.target.value))}
        >
          {pairs.map((item) => (
            <option key={item.request.id} value={item.request.id}>
              {item.request.label} · {item.request.size} vehicles · {money(item.request.value)} ·
              today: {FATE[item.before.fate]}
              {changed ? ` · with your changes: ${FATE[item.after.fate]}` : ""}
            </option>
          ))}
        </select>
      </div>
      <Scroll label="This customer's story">
        <table className={`${styles.table} ${styles.story}`}>
          <thead>
            <tr>
              <th scope="col">
                {pair.request.label}, {pair.request.size} vehicles
              </th>
              <th scope="col">Today</th>
              {changed ? <th scope="col">With your changes</th> : null}
            </tr>
          </thead>
          <tbody>
            {MOMENTS.map((label, index) => {
              const was = before.moments[index];
              const now = after.moments[index];
              if (!was || !now) return null;
              return (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td data-gave-up={was.gaveUp || undefined}>
                    {was.gaveUp ? "Gave up waiting: " : ""}
                    {momentText(was, pair.request.at)}
                    {was.note ? <span className={styles.before}>{was.note}</span> : null}
                  </td>
                  {changed ? (
                    <td data-gave-up={now.gaveUp || undefined}>
                      {now.gaveUp ? "Gave up waiting: " : ""}
                      {momentText(now, pair.request.at)}
                      {now.note ? <span className={styles.before}>{now.note}</span> : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">How it ends</th>
              <td data-fate={pair.before.fate}>{before.ending}</td>
              {changed ? <td data-fate={pair.after.fate}>{after.ending}</td> : null}
            </tr>
          </tfoot>
        </table>
      </Scroll>
      {changed ? null : (
        <p className={styles.note}>
          Make a change above and this table gains a second column: the same customer, in the
          company as you changed it.
        </p>
      )}
    </div>
  );
}
