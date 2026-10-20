"use client";

import type { Decision } from "@/core/routing/route";
import type { LabSettings } from "@/core/settings";
import type { WeekData } from "@/lib/lab/data";
import type { SqlState } from "@/lib/lab/sql";
import { AiPanel } from "./AiPanel";
import { Calibration } from "./Calibration";
import { DataQuality } from "./DataQuality";
import styles from "./Hood.module.css";
import { RunDetails } from "./RunDetails";
import { SqlConsole } from "./SqlConsole";

interface HoodPanelsProps {
  data: WeekData;
  decisions: Decision[];
  settings: LabSettings;
  sql: SqlState;
  routeMs: number;
  onOpen: (leadId: string) => void;
}

export function HoodPanels({ data, settings, sql, routeMs, onOpen }: HoodPanelsProps) {
  return (
    <section className={`page ${styles.hood}`} aria-labelledby="hood-title">
      <div className={styles.hoodHead}>
        <p className="eyebrow">Under the hood</p>
        <h2 id="hood-title" className={styles.hoodTitle}>
          The same run, opened up
        </h2>
        <p className={styles.hoodLede}>
          Every panel reads the same decisions as the view above and updates when you move a dial.
          For the rules themselves, the AI contract and the design decisions, read{" "}
          <a href="/architecture">how it is built</a>.
        </p>
      </div>
      <div className={styles.grid}>
        <div className={styles.wide}>
          <SqlConsole sql={sql} onOpen={onOpen} />
        </div>
        <Calibration sql={sql} threshold={settings.threshold} />
        <DataQuality sql={sql} onOpen={onOpen} />
        <div className={styles.wide}>
          <AiPanel data={data} settings={settings} onOpen={onOpen} />
        </div>
        <div className={styles.wide}>
          <RunDetails data={data} sql={sql} routeMs={routeMs} />
        </div>
      </div>
    </section>
  );
}
