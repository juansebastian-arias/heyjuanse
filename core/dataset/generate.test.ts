import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDataFiles } from "../../scripts/generate-datasets";
import { generateCompanies, generateWeek, RAW_LEADS_PER_WEEK } from "./generate";
import { WEEKS } from "./weeks";

const companies = generateCompanies();
const weeks = WEEKS.map((week) => generateWeek(week, companies));

describe("synthetic data generator", () => {
  it("is deterministic", () => {
    const [first] = WEEKS;
    if (!first) throw new Error("No weeks defined");
    expect(generateWeek(first, generateCompanies())).toEqual(weeks[0]);
  });

  it("creates the published number of companies with unique domains", () => {
    expect(companies.filter((c) => !c.isCompetitor)).toHaveLength(240);
    expect(new Set(companies.map((c) => c.domain)).size).toBe(companies.length);
  });

  it.each(WEEKS.map((week, i) => [week.id, i] as const))(
    "week %s has 400 records in arrival order",
    (_id, i) => {
      const dataset = weeks[i];
      if (!dataset) throw new Error("missing week");
      expect(dataset.rawLeads).toHaveLength(RAW_LEADS_PER_WEEK);
      const ids = dataset.rawLeads.map((lead) => lead.rawId);
      expect(new Set(ids).size).toBe(ids.length);
      const times = dataset.rawLeads.map((lead) => lead.receivedAt);
      expect([...times].sort()).toEqual(times);
      for (const time of times) {
        expect(time >= `${dataset.weekStart}T00:00:00`).toBe(true);
        expect(time <= `${dataset.weekEnd}T23:59:59.999Z`).toBe(true);
      }
    },
  );

  it("only ever uses reserved .example domains", () => {
    for (const dataset of weeks) {
      for (const lead of dataset.rawLeads) {
        const domain = lead.email?.split("@")[1];
        if (domain) expect(domain.toLowerCase().endsWith(".example")).toBe(true);
        if (lead.website) expect(lead.website).toMatch(/\.example(\/|$)/);
      }
      for (const email of dataset.suppressions) expect(email.endsWith(".example")).toBe(true);
    }
    for (const company of companies) expect(company.domain.endsWith(".example")).toBe(true);
  });

  it("links every record to exactly one person and every message to its annotation", () => {
    for (const dataset of weeks) {
      const owners = new Map<string, number>();
      for (const person of dataset.truth.people) {
        for (const rawId of person.rawIds) owners.set(rawId, (owners.get(rawId) ?? 0) + 1);
      }
      for (const lead of dataset.rawLeads) expect(owners.get(lead.rawId)).toBe(1);
      const annotated = new Set(dataset.truth.messages.map((m) => m.rawId));
      for (const lead of dataset.rawLeads)
        expect(annotated.has(lead.rawId)).toBe(lead.message !== null);
    }
  });

  it("produces a plausible mix of needs and duplicates", () => {
    for (const dataset of weeks) {
      const people = dataset.truth.people;
      const needRate = people.filter((p) => p.hasNeed).length / people.length;
      expect(needRate).toBeGreaterThan(0.12);
      expect(needRate).toBeLessThan(0.3);
      const duplicates = people.filter((p) => p.rawIds.length > 1).length;
      expect(duplicates).toBeGreaterThan(20);
      expect(people.every((p) => p.persona === "buyer" || !p.hasNeed)).toBe(true);
    }
  });

  it("matches the committed data files", () => {
    for (const [path, text] of buildDataFiles()) {
      const onDisk = readFileSync(join(process.cwd(), "public", "data", path), "utf8");
      expect(onDisk, `public/data/${path} is out of date: run pnpm data:generate`).toBe(text);
    }
  });
});
