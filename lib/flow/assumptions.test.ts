import { describe, expect, it } from "vitest";
import { type Assumptions, BASE, LEVER_IDS, LEVERS } from "@/core/flow/company";
import { TWEAK_IDS, TWEAKS } from "@/core/flow/scenario";
import { assumptionGroups } from "./assumptions";

const rows = (a: Assumptions) => assumptionGroups(a).flatMap((group) => group.rows);

describe("the list of assumptions the site publishes", () => {
  it("leaves out nothing the model takes as given", () => {
    const shown = new Set(rows(BASE).flatMap((row) => row.keys));
    const missing = (Object.keys(BASE) as Array<keyof Assumptions>).filter(
      (key) => !shown.has(key),
    );
    expect(missing).toEqual([]);
  });

  it("names no assumption the model does not have", () => {
    const known = new Set(Object.keys(BASE));
    for (const row of rows(BASE)) {
      for (const key of row.keys) expect(known.has(key), `${row.label}: ${key}`).toBe(true);
    }
  });

  it("gives every row a label and a value, and no label twice", () => {
    const labels = rows(BASE).map((row) => row.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const row of rows(BASE)) {
      expect(row.label.length).toBeGreaterThan(5);
      expect(row.value.length).toBeGreaterThan(0);
    }
  });

  it("lists what every improvement costs", () => {
    const text = rows(BASE)
      .map((row) => `${row.label} ${row.value}`)
      .join("\n");
    for (const id of LEVER_IDS) {
      expect(text).toContain(LEVERS[id].name);
      expect(text).toContain(`$${LEVERS[id].setup.toLocaleString("en-US")} to build`);
    }
  });

  it("changes when an assumption does: every row is read from the values in use", () => {
    const before = rows(BASE);
    for (const key of Object.keys(BASE) as Array<keyof Assumptions>) {
      const changed = { ...BASE, [key]: nudge(BASE[key]) } as Assumptions;
      const after = rows(changed);
      const moved = after.filter((row, index) => row.value !== before[index]?.value);
      expect(moved.length, key).toBeGreaterThan(0);
      for (const row of moved) expect(row.keys, `${row.label} moved with ${key}`).toContain(key);
    }
  });

  it("follows the visitor's own values for the assumptions they can move", () => {
    for (const id of TWEAK_IDS) {
      const tweak = TWEAKS[id];
      const a = tweak.write(BASE, tweak.high);
      const before = rows(BASE).map((row) => row.value);
      const after = rows(a).map((row) => row.value);
      expect(after, tweak.label).not.toEqual(before);
    }
  });
});

/** A different value of the same shape: numbers grow, and so does every number in a record. */
function nudge(value: unknown): unknown {
  if (typeof value === "number") return value === 0 ? 0.5 : value * 1.5 + 0.07;
  if (value === null) return 3;
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, nudge(inner)]),
    );
  }
  return value;
}
