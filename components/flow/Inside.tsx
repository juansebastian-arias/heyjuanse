"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import styles from "./Inside.module.css";

export interface InsideTab {
  id: string;
  label: string;
  /** Built the first time the tab is opened, then kept, so its state survives switching tabs. */
  render(): ReactNode;
}

/**
 * The layers under the main screen, as tabs. Each answers one question a careful reader would
 * ask: why does that happen, what happens to one customer, what if an assumption is wrong, is
 * the engine right, and what does the AI step actually do.
 */
export function Inside({ tabs }: { tabs: readonly InsideTab[] }) {
  const base = useId();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [opened, setOpened] = useState<readonly string[]>(tabs[0] ? [tabs[0].id] : []);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function open(id: string) {
    setActive(id);
    setOpened((previous) => (previous.includes(id) ? previous : [...previous, id]));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    const tab = tabs[target];
    if (!tab) return;
    open(tab.id);
    buttons.current[target]?.focus();
  }

  return (
    <section className={styles.inside} id="inside" aria-labelledby={`${base}-title`}>
      <header className={styles.header}>
        <h2 id={`${base}-title`} className={styles.title}>
          Look inside
        </h2>
        <p className={styles.intro}>
          Nothing above is written by hand. Every figure comes out of a simulation you can open,
          question and check.
        </p>
      </header>
      <div className={styles.tabs} role="tablist" aria-labelledby={`${base}-title`}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            className={styles.tab}
            aria-selected={active === tab.id}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => open(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          className={styles.panel}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={active !== tab.id}
        >
          {opened.includes(tab.id) ? tab.render() : null}
        </div>
      ))}
    </section>
  );
}
