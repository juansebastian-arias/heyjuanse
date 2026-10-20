"use client";

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { leadHasNeed } from "@/core/backtest/metrics";
import type { Decision, Lane } from "@/core/routing/route";
import { LANE_LABELS, LANES } from "@/core/routing/route";
import type { WeekData } from "@/lib/lab/data";
import styles from "./LaneField.module.css";

export const LANE_DESCRIPTIONS: Record<Lane, string> = {
  sales:
    "At or above the threshold. Sales calls them in queue order until this week's calls run out.",
  review: "A person checks an AI signal before anything else happens.",
  nurture: "Below the threshold, or a student. Marketing keeps in touch.",
  fix_data: "Cannot be worked yet: no valid email, or a personal email with no company.",
  not_for_sales: "Customers, competitors, opt-outs, vendors, job seekers and spam.",
};

interface Placed {
  leadId: string;
  x: number;
  y: number;
  lane: Lane;
  called: boolean;
  need: boolean;
  /** Index in keyboard order. */
  order: number;
  /** Section the mark belongs to, for up and down arrow movement. */
  section: string;
  column: number;
  row: number;
}

interface Header {
  key: string;
  y: number;
  lane: Lane;
  kind: "lane" | "divider";
  count: number;
  needs: number;
}

interface LaneFieldProps {
  data: WeekData;
  decisions: Decision[];
  capacity: number;
  highlighted: ReadonlySet<string>;
  selectedId: string | null;
  showDescriptions: boolean;
  onOpen: (leadId: string) => void;
}

const HEADER_HEIGHT = 30;
const HEADER_HEIGHT_NARROW = 46;
const DIVIDER_HEIGHT = 26;
const LANE_GAP = 22;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const listener = (event: MediaQueryListEvent) => setCoarse(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return coarse;
}

export function LaneField({
  data,
  decisions,
  capacity,
  highlighted,
  selectedId,
  showDescriptions,
  onOpen,
}: LaneFieldProps) {
  const [containerRef, width] = useWidth<HTMLDivElement>();
  const coarse = useCoarsePointer();
  const size = coarse ? 13 : 11;
  const pitch = size + (coarse ? 4 : 3);
  const columns = Math.max(8, Math.floor((width + (pitch - size)) / pitch));

  const layout = useMemo(() => {
    const byLane = new Map<Lane, Decision[]>(LANES.map((lane) => [lane, []]));
    for (const decision of decisions) byLane.get(decision.lane)?.push(decision);
    for (const [lane, list] of byLane) {
      if (lane === "sales") list.sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
      else list.sort((a, b) => b.score.total - a.score.total || a.leadId.localeCompare(b.leadId));
    }
    const placed: Placed[] = [];
    const headers: Header[] = [];
    const narrow = width < 560;
    const headerHeight = narrow ? HEADER_HEIGHT_NARROW : HEADER_HEIGHT;
    const descriptionHeight = showDescriptions && !narrow ? 20 : 0;
    let y = 0;
    let order = 0;
    const placeSection = (lane: Lane, section: string, list: Decision[]) => {
      list.forEach((decision, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        placed.push({
          leadId: decision.leadId,
          x: column * pitch,
          y: y + row * pitch,
          lane,
          called: decision.called,
          need: leadHasNeed(decision.leadId, data.labelIndex),
          order: order++,
          section,
          column,
          row,
        });
      });
      y += Math.max(1, Math.ceil(list.length / columns)) * pitch;
    };
    for (const lane of LANES) {
      const list = byLane.get(lane) ?? [];
      const needs = list.filter((d) => leadHasNeed(d.leadId, data.labelIndex)).length;
      headers.push({ key: lane, y, lane, kind: "lane", count: list.length, needs });
      y += headerHeight + descriptionHeight;
      if (lane === "sales") {
        const called = list.filter((d) => d.called);
        const waiting = list.filter((d) => !d.called);
        placeSection(lane, "sales:called", called);
        if (waiting.length > 0) {
          headers.push({
            key: "sales-divider",
            y: y + 4,
            lane,
            kind: "divider",
            count: waiting.length,
            needs: waiting.filter((d) => leadHasNeed(d.leadId, data.labelIndex)).length,
          });
          y += DIVIDER_HEIGHT;
          placeSection(lane, "sales:waiting", waiting);
        }
      } else {
        placeSection(lane, lane, list);
      }
      y += LANE_GAP;
    }
    return { placed, headers, height: y };
  }, [decisions, columns, pitch, showDescriptions, data.labelIndex, width]);

  // Roving tab index: one tab stop for the whole field, arrows move between marks.
  const [activeId, setActiveId] = useState<string | null>(null);
  const markRefs = useRef(new Map<string, HTMLButtonElement>());
  const placedById = useMemo(
    () => new Map(layout.placed.map((p) => [p.leadId, p])),
    [layout.placed],
  );
  const decisionById = useMemo(() => new Map(decisions.map((d) => [d.leadId, d])), [decisions]);
  const focusId =
    activeId && placedById.has(activeId) ? activeId : (layout.placed[0]?.leadId ?? null);

  const moveFocus = useCallback((leadId: string | undefined) => {
    if (!leadId) return;
    setActiveId(leadId);
    markRefs.current.get(leadId)?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: Placed) => {
    const list = layout.placed;
    let target: Placed | undefined;
    switch (event.key) {
      case "ArrowRight":
        target = list[current.order + 1];
        break;
      case "ArrowLeft":
        target = list[current.order - 1];
        break;
      case "ArrowDown": {
        target = list.find(
          (p) =>
            p.section === current.section &&
            p.row === current.row + 1 &&
            p.column === current.column,
        );
        if (!target) {
          const sectionEnd = list.filter((p) => p.section === current.section).at(-1);
          target =
            sectionEnd && sectionEnd.order !== current.order && sectionEnd.row > current.row
              ? sectionEnd
              : list[(sectionEnd?.order ?? current.order) + 1];
        }
        break;
      }
      case "ArrowUp": {
        target = list.find(
          (p) =>
            p.section === current.section &&
            p.row === current.row - 1 &&
            p.column === current.column,
        );
        if (!target) {
          const sectionStart = list.find((p) => p.section === current.section);
          target =
            sectionStart && sectionStart.order !== current.order
              ? list[sectionStart.order - 1]
              : list[current.order - 1];
        }
        break;
      }
      case "Home":
        target = list[0];
        break;
      case "End":
        target = list.at(-1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(target?.leadId);
  };

  const describe = (p: Placed): string => {
    const lead = data.leadById.get(p.leadId);
    const decision = decisionById.get(p.leadId);
    const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || "Unnamed";
    const company = lead?.match?.company.name ?? lead?.companyName ?? "no company";
    const where =
      p.lane === "sales"
        ? p.called
          ? `called, queue position ${decision?.queuePosition}`
          : `over capacity, queue position ${decision?.queuePosition}`
        : LANE_LABELS[p.lane];
    return `${p.leadId}, ${name}, ${company}. ${LANE_LABELS[p.lane]}${p.lane === "sales" ? `, ${where}` : ""}. Score ${decision?.score.total}. ${p.need ? "Had a real need" : "No real need"} according to the answer key.`;
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.field}
        style={{ height: layout.height, ["--size" as string]: `${size}px` }}
        role="group"
        aria-label={`${decisions.length} leads in five lanes. Use the arrow keys to move between leads and Enter to open one.`}
      >
        {layout.headers.map((header) =>
          header.kind === "lane" ? (
            <div
              key={header.key}
              className={styles.laneHeader}
              style={{ transform: `translateY(${header.y}px)` }}
              data-lane={header.lane}
            >
              <span className={styles.laneName}>
                <span className={styles.swatch} aria-hidden="true" />
                {LANE_LABELS[header.lane]}
              </span>
              <span className={styles.laneCount}>
                <span className="num">{header.count}</span> {header.count === 1 ? "lead" : "leads"}
                <span className={styles.needCount}>
                  {" · "}
                  <span className="num">{header.needs}</span> with a real need
                </span>
                {header.lane === "sales" ? (
                  <span className={styles.capacity}>
                    {" · "}capacity <span className="num">{capacity}</span>
                  </span>
                ) : null}
              </span>
              {showDescriptions && width >= 560 ? (
                <span className={styles.laneDescription}>{LANE_DESCRIPTIONS[header.lane]}</span>
              ) : null}
            </div>
          ) : (
            <div
              key={header.key}
              className={styles.divider}
              style={{ transform: `translateY(${header.y}px)` }}
            >
              <span>
                Over capacity: <span className="num">{header.count}</span> waiting,{" "}
                <span className="num">{header.needs}</span> with a real need
              </span>
            </div>
          ),
        )}
        {layout.placed.map((p) => (
          <button
            key={p.leadId}
            type="button"
            ref={(element) => {
              if (element) markRefs.current.set(p.leadId, element);
              else markRefs.current.delete(p.leadId);
            }}
            className={styles.mark}
            style={{
              transform: `translate(${p.x}px, ${p.y}px)`,
              transitionDelay: `${Math.min(p.order % 60, 40) * 3}ms`,
            }}
            data-lane={p.lane}
            data-need={p.need}
            data-waiting={p.lane === "sales" && !p.called}
            data-highlight={highlighted.has(p.leadId) || undefined}
            data-selected={selectedId === p.leadId || undefined}
            tabIndex={p.leadId === focusId ? 0 : -1}
            aria-label={describe(p)}
            onFocus={() => setActiveId(p.leadId)}
            onKeyDown={(event) => onKeyDown(event, p)}
            onClick={() => onOpen(p.leadId)}
          />
        ))}
      </div>
      <ul className={styles.legend} aria-label="How to read the marks">
        <li>
          <span className={styles.legendMark} data-need="true" aria-hidden="true" /> Had a real need
          (answer key)
        </li>
        <li>
          <span className={styles.legendMark} data-need="false" aria-hidden="true" /> No real need
        </li>
        <li>
          <span
            className={styles.legendMark}
            data-need="true"
            data-waiting="true"
            aria-hidden="true"
          />{" "}
          Faded: over capacity, waits until next week
        </li>
        <li>
          <span
            className={styles.legendMark}
            data-need="false"
            data-highlight="true"
            aria-hidden="true"
          />{" "}
          Moved by your last change
        </li>
      </ul>
    </div>
  );
}
