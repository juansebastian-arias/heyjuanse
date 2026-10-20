import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AiSignals } from "../ai/signals";
import { BUDGETS, INTENTS, LEAD_SOURCES, type LeadSource, NEXT_STEPS, TIMELINES } from "../model";
import { company, leadFrom, signals } from "../test/fixtures";
import { AI_POINTS, INTENT_POINTS } from "./rules";
import { aiLines, bestSource, scoreLead } from "./score";

const activityArb = fc.record({
  pricingPageViews: fc.nat(8),
  docsVisits: fc.nat(8),
  webinarAttended: fc.boolean(),
  emailClicks: fc.nat(8),
  lastActivityDaysAgo: fc.option(fc.nat(30), { nil: null }),
});

const signalsArb: fc.Arbitrary<AiSignals> = fc.record({
  intent: fc.constantFrom(...INTENTS),
  timeline: fc.constantFrom(...TIMELINES),
  budget: fc.constantFrom(...BUDGETS),
  nextStep: fc.constantFrom(...NEXT_STEPS),
  painPoints: fc.constant([]),
  language: fc.constant("en" as const),
  injection: fc.boolean(),
  confidence: fc.constantFrom("high" as const, "medium" as const, "low" as const),
});

describe("scoreLead", () => {
  it("scores a strong lead from the published tables", () => {
    const lead = leadFrom({
      source: "demo_request",
      activity: {
        pricingPageViews: 3,
        docsVisits: 4,
        webinarAttended: true,
        emailClicks: 2,
        lastActivityDaysAgo: 1,
      },
    });
    const result = scoreLead(lead, null);
    // Fit: manufacturing 15 + 200-999 15 + North America 10 = 40.
    expect(result.groups.fit).toBe(40);
    // Intent: demo 20 + behavior 8+4+3+2=17 capped at 15 + recency 5 = 40.
    expect(result.groups.intent).toBe(40);
    expect(result.total).toBe(80);
    expect(result.lines.some((line) => line.label === "Behavior capped at 15")).toBe(true);
  });

  it("gives middle points when the company is unknown", () => {
    const lead = leadFrom(
      { email: "ana@unknown-co.example", companyName: "Unknown Co", country: null },
      [company()],
    );
    const result = scoreLead(lead, null);
    expect(result.groups.fit).toBe(5 + 5 + 4);
  });

  it("caps AI points at +25 and floors them at -10", () => {
    const best = aiLines(signals());
    expect(best.reduce((sum, line) => sum + line.points, 0)).toBe(AI_POINTS.max);
    const worst = aiLines(
      signals({
        intent: "general_interest",
        timeline: "over_three_months",
        budget: "constrained",
        nextStep: "none",
      }),
    );
    expect(worst.reduce((sum, line) => sum + line.points, 0)).toBe(-8);
  });

  it("uses the strongest source across submissions", () => {
    expect(bestSource(["content_download", "demo_request", "webinar"])).toBe("demo_request");
  });

  it("always stays within 0..100 and within each group's limits", () => {
    fc.assert(
      fc.property(
        activityArb,
        fc.constantFrom(...LEAD_SOURCES),
        fc.option(signalsArb, { nil: null }),
        (activity, source, ai) => {
          const result = scoreLead(leadFrom({ activity, source }), ai);
          expect(result.total).toBeGreaterThanOrEqual(0);
          expect(result.total).toBeLessThanOrEqual(100);
          expect(result.groups.fit).toBeLessThanOrEqual(40);
          expect(result.groups.intent).toBeLessThanOrEqual(40);
          expect(result.groups.ai).toBeGreaterThanOrEqual(AI_POINTS.min);
          expect(result.groups.ai).toBeLessThanOrEqual(AI_POINTS.max);
        },
      ),
      { numRuns: 150 },
    );
  });

  it("never lowers the score when a buyer shows more activity", () => {
    fc.assert(
      fc.property(
        activityArb,
        fc.nat(4),
        fc.nat(4),
        fc.nat(4),
        (activity, morePricing, moreDocs, moreClicks) => {
          const before = scoreLead(leadFrom({ activity }), null).total;
          const more = {
            ...activity,
            pricingPageViews: activity.pricingPageViews + morePricing,
            docsVisits: activity.docsVisits + moreDocs,
            emailClicks: activity.emailClicks + moreClicks,
          };
          expect(scoreLead(leadFrom({ activity: more }), null).total).toBeGreaterThanOrEqual(
            before,
          );
        },
      ),
      { numRuns: 150 },
    );
  });

  it("never lowers the score when activity is more recent", () => {
    fc.assert(
      fc.property(activityArb, fc.nat(30), (activity, earlier) => {
        const days = activity.lastActivityDaysAgo;
        if (days === null) return;
        const recent = { ...activity, lastActivityDaysAgo: Math.max(0, days - earlier) };
        expect(scoreLead(leadFrom({ activity: recent }), null).total).toBeGreaterThanOrEqual(
          scoreLead(leadFrom({ activity }), null).total,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("never lowers the score when the source carries more intent", () => {
    const sources = [...LEAD_SOURCES].sort(
      (a, b) => INTENT_POINTS.source[a] - INTENT_POINTS.source[b],
    );
    fc.assert(
      fc.property(
        activityArb,
        fc.nat(sources.length - 1),
        fc.nat(sources.length - 1),
        (activity, i, j) => {
          const low = sources[Math.min(i, j)] as LeadSource;
          const high = sources[Math.max(i, j)] as LeadSource;
          expect(
            scoreLead(leadFrom({ activity, source: high }), null).total,
          ).toBeGreaterThanOrEqual(scoreLead(leadFrom({ activity, source: low }), null).total);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("an approved budget or a shorter timeline never lowers the score", () => {
    const lead = leadFrom();
    fc.assert(
      fc.property(signalsArb, (ai) => {
        const base = scoreLead(lead, ai).total;
        expect(scoreLead(lead, { ...ai, budget: "approved" }).total).toBeGreaterThanOrEqual(
          ai.budget === "approved"
            ? base
            : Math.min(base, scoreLead(lead, { ...ai, budget: "approved" }).total),
        );
        expect(scoreLead(lead, { ...ai, timeline: "within_30_days" }).total).toBeGreaterThanOrEqual(
          base,
        );
      }),
      { numRuns: 150 },
    );
  });
});
