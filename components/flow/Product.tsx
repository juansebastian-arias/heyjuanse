"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Setup, StationId } from "@/core/flow/company";
import { worstLoss } from "@/core/flow/diagnose";
import { moveStation, type Option } from "@/core/flow/planner";
import {
  assumptionsFor,
  decodeScenario,
  encodeScenario,
  isChanged,
  START,
  type Tweaks,
} from "@/core/flow/scenario";
import { count, money } from "@/lib/flow/format";
import { FlowStore } from "@/lib/flow/store";
import type { View } from "@/lib/flow/view";
import { WAITING_FOR } from "@/lib/flow/words";
import { Floor } from "./Floor";
import { Inside, type InsideTab } from "./Inside";
import { AgentPanel } from "./inside/AgentPanel";
import { AssumptionsPanel } from "./inside/AssumptionsPanel";
import { ChecksPanel, type TestSummary } from "./inside/ChecksPanel";
import { CustomerPanel } from "./inside/CustomerPanel";
import { WhyPanel } from "./inside/WhyPanel";
import { NextMove } from "./NextMove";
import { PlanPanel } from "./PlanPanel";
import styles from "./Product.module.css";
import { Scoreboard } from "./Scoreboard";
import { StationPanel } from "./StationPanel";

/** Delay before the page starts simulating ahead, so the first paint is not competing with it. */
const WARM_AFTER_MS = 800;

/** The most recent value that was not null: what to keep on screen while its replacement is computed. */
function useLast<T>(value: T | null): T | null {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  return value ?? last;
}

interface ProductProps {
  /** The first screen, simulated where the page was built. */
  initial: View;
  /** What the automated tests said when the site was built, if they ran. */
  tests: TestSummary | null;
  repository: string;
}

export function Product({ initial, tests, repository }: ProductProps) {
  const [store] = useState(() => new FlowStore(initial));
  const view = useSyncExternalStore(store.subscribe, store.getView, store.getInitialView);
  /** The team the visitor chose to look at. Null follows the best next move. */
  const [picked, setPicked] = useState<StationId | null>(null);

  useEffect(() => {
    // A link can carry a scenario. The page itself is built once, for the starting point.
    store.setScenario(decodeScenario(window.location.search));
    const timer = window.setTimeout(() => store.warm(), WARM_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      store.dispose();
    };
  }, [store]);

  const query = encodeScenario(view.scenario);
  const written = useRef<string | null>(null);
  useEffect(() => {
    const first = written.current === null;
    const same = written.current === query;
    written.current = query;
    if (first || same) return;
    const { pathname, hash } = window.location;
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}${hash}`);
  }, [query]);

  const { scenario } = view;
  const next = view.plan[0] ?? null;
  const flagged = next ? moveStation(next.move) : null;
  const today = useLast(view.today);
  const todayReadings = useLast(view.todayReadings);
  const outcome = useLast(view.outcome);
  const options = useLast(view.options);
  const station = useLast(picked ?? flagged) ?? "reply";
  const changed = isChanged(scenario.setup);

  const setSetup = useCallback(
    (setup: Setup) => store.setScenario({ setup, tweaks: store.getView().scenario.tweaks }),
    [store],
  );
  const setTweaks = useCallback(
    (tweaks: Tweaks) => store.setScenario({ setup: store.getView().scenario.setup, tweaks }),
    [store],
  );
  const apply = useCallback(
    (option: Option, follow: boolean) => {
      // After the recommended move the page goes on to wherever the next one is.
      if (follow) setPicked(null);
      setSetup(option.setup);
    },
    [setSetup],
  );
  const reset = useCallback(() => {
    setPicked(null);
    store.setScenario(START);
  }, [store]);

  const assumptions = assumptionsFor(scenario.tweaks);
  const tabs: InsideTab[] = [
    {
      id: "why",
      label: "Why the line forms",
      render: () => (
        <WhyPanel scenario={scenario} today={today} now={outcome?.now ?? null} changed={changed} />
      ),
    },
    {
      id: "customer",
      label: "Follow one customer",
      render: () => <CustomerPanel scenario={scenario} />,
    },
    {
      id: "assumptions",
      label: "Change the assumptions",
      render: () => (
        <AssumptionsPanel scenario={scenario} plan={view.plan} store={store} onTweaks={setTweaks} />
      ),
    },
    {
      id: "checks",
      label: "Check the math",
      render: () => <ChecksPanel store={store} tests={tests} repository={repository} />,
    },
    {
      id: "ai",
      label: "Try the AI step",
      render: () => (
        <AgentPanel
          worth={{
            manualMinutes: assumptions.touchMinutes.reply,
            draftedMinutes: assumptions.draftedReplyMinutes,
            waitHours: todayReadings?.[0]?.waitHours ?? null,
          }}
        />
      ),
    },
  ];

  const lost = today?.totals.lostBuyers.mean ?? 0;
  const worst = todayReadings ? worstLoss(todayReadings) : null;
  const share = worst && lost > 0 ? worst.lostBuyers / lost : 0;

  return (
    <div className={`page ${styles.product}`}>
      <header className={styles.hero}>
        <div>
          <p className="eyebrow">A made-up company · a working simulation</p>
          <h1 className={styles.title}>
            Find where this company loses its customers. Then fix it.
          </h1>
        </div>
        <p className={styles.lede}>
          Larkspur sells route-planning software to delivery fleets.
          {today ? (
            <>
              {" "}
              As it runs today it collects about {money(today.totals.cash.mean)} a month
              {worst ? (
                <>
                  , and about <strong>{count(lost)} companies a month</strong> that would have
                  bought give up while they wait, {share > 0.5 ? "most" : "many"} of them{" "}
                  {WAITING_FOR[worst.station]}.
                </>
              ) : (
                ". Hardly anyone gives up waiting."
              )}
            </>
          ) : null}
        </p>
      </header>

      <NextMove
        view={view}
        today={today}
        changed={changed}
        onApply={(option) => apply(option, true)}
        onReset={reset}
        onRetry={() => store.retry()}
      />

      <Floor scenario={scenario} flagged={flagged} selected={station} onSelect={setPicked} />

      <Scoreboard today={today} outcome={outcome} changed={changed} busy={view.outcome === null} />

      <div className={styles.columns}>
        <StationPanel
          station={station}
          onStation={setPicked}
          scenario={scenario}
          readings={outcome?.readings ?? null}
          todayReadings={todayReadings}
          options={options}
          stale={view.outcome === null}
          busy={view.options === null}
          best={next}
          onApply={apply}
          onSetup={setSetup}
        />
        <PlanPanel view={view} onApply={apply} onSetup={setSetup} onReset={reset} />
      </div>

      <Inside tabs={tabs} />

      <p className={styles.bridge}>
        Larkspur is made up; the method is not. At a real company it starts from the timestamps a
        CRM and a billing system already keep: when each request arrived, when someone picked it up,
        and when it was paid or lost.{" "}
        <Link href="/engine#company">The same work, in five steps</Link>
      </p>
    </div>
  );
}
