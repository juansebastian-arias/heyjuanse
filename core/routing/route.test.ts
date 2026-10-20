import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LeadAiSignals } from "../ai/signals";
import { company, leadFrom, leadsFrom, rawLead, signals } from "../test/fixtures";
import { DEFAULT_ROUTING, type RoutingSettings, routeLeads } from "./route";

const strong = {
  source: "demo_request" as const,
  activity: {
    pricingPageViews: 3,
    docsVisits: 4,
    webinarAttended: true,
    emailClicks: 2,
    lastActivityDaysAgo: 1,
  },
};
const weak = {
  source: "content_download" as const,
  activity: {
    pricingPageViews: 0,
    docsVisits: 0,
    webinarAttended: false,
    emailClicks: 0,
    lastActivityDaysAgo: null,
  },
};

const routeOne = (
  lead: ReturnType<typeof leadFrom>,
  ai: LeadAiSignals | null,
  settings: Partial<RoutingSettings> = {},
) => {
  const map = new Map<string, LeadAiSignals>();
  if (ai) map.set(lead.leadId, ai);
  const [decision] = routeLeads([lead], map, { ...DEFAULT_ROUTING, ...settings });
  if (!decision) throw new Error("Expected a decision");
  return decision;
};

describe("eligibility rules", () => {
  it("sends a lead with no valid email to Fix data, before anything else", () => {
    const lead = leadFrom({ ...strong, email: "n/a" }, [company({ isCompetitor: true })]);
    expect(routeOne(lead, null)).toMatchObject({ lane: "fix_data", reason: "INVALID_CONTACT" });
  });

  it("respects the suppression list even for a strong lead", () => {
    const lead = leadFrom(
      { ...strong, email: "ana@acme.example" },
      [company()],
      ["ana@acme.example"],
    );
    expect(routeOne(lead, null)).toMatchObject({ lane: "not_for_sales", reason: "SUPPRESSED" });
  });

  it("keeps competitors and customers out of the sales queue", () => {
    expect(routeOne(leadFrom(strong, [company({ isCompetitor: true })]), null).reason).toBe(
      "COMPETITOR",
    );
    expect(routeOne(leadFrom(strong, [company({ isCustomer: true })]), null).reason).toBe(
      "EXISTING_CUSTOMER",
    );
  });

  it("sends a personal email with no company to Fix data", () => {
    const lead = leadFrom({ ...strong, email: "ana77@freemail.example", companyName: null });
    expect(routeOne(lead, null)).toMatchObject({
      lane: "fix_data",
      reason: "UNIDENTIFIED_COMPANY",
    });
  });

  it("routes on the threshold when every rule passes", () => {
    expect(routeOne(leadFrom(strong), null)).toMatchObject({
      lane: "sales",
      called: true,
      queuePosition: 1,
    });
    expect(routeOne(leadFrom(weak), null)).toMatchObject({
      lane: "nurture",
      reason: "SCORE_BELOW_THRESHOLD",
    });
  });
});

describe("AI policy", () => {
  it("ignores AI completely when the policy is off", () => {
    const lead = leadFrom(weak);
    const decision = routeOne(lead, signals({ injection: true }), { aiPolicy: "off" });
    expect(decision).toMatchObject({ lane: "nurture", aiUsed: false });
  });

  it("uses trusted signals to lift a quiet buyer into sales", () => {
    const lead = leadFrom({ ...weak, source: "chat" });
    expect(routeOne(lead, null).lane).toBe("nurture");
    const decision = routeOne(lead, signals({ confidence: "high" }), { aiPolicy: "high" });
    expect(decision).toMatchObject({ lane: "sales", aiUsed: true, laneWithoutAi: "nurture" });
  });

  it("sends an untrusted signal to review only when it would change the lane", () => {
    const lead = leadFrom({ ...weak, source: "chat" });
    const changes = routeOne(lead, signals({ confidence: "medium" }), { aiPolicy: "high" });
    expect(changes).toMatchObject({ lane: "review", reason: "AI_UNTRUSTED_CHANGES_LANE" });
    const noChange = routeOne(
      lead,
      signals({
        confidence: "medium",
        intent: "general_interest",
        timeline: "not_stated",
        budget: "not_mentioned",
        nextStep: "none",
      }),
      { aiPolicy: "high" },
    );
    expect(noChange).toMatchObject({ lane: "nurture", aiUsed: false });
  });

  it("trusts medium confidence under the high-and-medium policy", () => {
    const lead = leadFrom({ ...weak, source: "chat" });
    expect(
      routeOne(lead, signals({ confidence: "medium" }), { aiPolicy: "high_medium" }).lane,
    ).toBe("sales");
    expect(routeOne(lead, signals({ confidence: "low" }), { aiPolicy: "high_medium" }).lane).toBe(
      "review",
    );
  });

  it("sends a message that tried to instruct the AI to review", () => {
    const decision = routeOne(leadFrom(strong), signals({ injection: true }), { aiPolicy: "high" });
    expect(decision).toMatchObject({ lane: "review", reason: "INJECTION" });
  });

  it("cannot override data rules", () => {
    const lead = leadFrom({ ...strong, email: "n/a" });
    expect(routeOne(lead, signals(), { aiPolicy: "high" }).lane).toBe("fix_data");
  });

  it("excludes support requests and vendor pitches when trusted", () => {
    const lead = leadFrom(strong);
    expect(
      routeOne(lead, signals({ intent: "existing_customer_support" }), { aiPolicy: "high" }).reason,
    ).toBe("AI_SUPPORT");
    expect(
      routeOne(lead, signals({ intent: "vendor_or_partner_pitch" }), { aiPolicy: "high" }).reason,
    ).toBe("AI_VENDOR");
    expect(
      routeOne(lead, signals({ intent: "student_or_research" }), { aiPolicy: "high" }).lane,
    ).toBe("nurture");
  });
});

describe("sales queue", () => {
  const leads = leadsFrom(
    Array.from({ length: 30 }, (_, i) =>
      rawLead({
        email: `person${i}@acme.example`,
        firstName: `P${String.fromCharCode(65 + (i % 26))}`,
        lastName: `L${i}`,
        source: i % 3 === 0 ? "demo_request" : i % 3 === 1 ? "pricing_contact" : "chat",
        activity: {
          pricingPageViews: i % 4,
          docsVisits: i % 5,
          webinarAttended: i % 2 === 0,
          emailClicks: i % 3,
          lastActivityDaysAgo: i % 9,
        },
      }),
    ),
  );
  const settingsArb = fc.record({
    capacity: fc.integer({ min: 0, max: 40 }),
    threshold: fc.integer({ min: 0, max: 100 }),
    queueOrder: fc.constantFrom("score" as const, "arrival" as const),
  });

  it("numbers the queue from 1 and calls exactly min(capacity, queue length)", () => {
    fc.assert(
      fc.property(settingsArb, (partial) => {
        const decisions = routeLeads(leads, new Map(), { ...DEFAULT_ROUTING, ...partial });
        const queue = decisions.filter((d) => d.lane === "sales");
        const positions = queue.map((d) => d.queuePosition).sort((a, b) => (a ?? 0) - (b ?? 0));
        expect(positions).toEqual(queue.map((_, i) => i + 1));
        expect(decisions.filter((d) => d.called)).toHaveLength(
          Math.min(partial.capacity, queue.length),
        );
      }),
    );
  });

  it("calls the highest scores first when ordered by score", () => {
    const decisions = routeLeads(leads, new Map(), {
      ...DEFAULT_ROUTING,
      threshold: 0,
      capacity: 10,
    });
    const called = decisions.filter((d) => d.called).map((d) => d.score.total);
    const waiting = decisions
      .filter((d) => d.lane === "sales" && !d.called)
      .map((d) => d.score.total);
    expect(Math.min(...called)).toBeGreaterThanOrEqual(Math.max(...waiting));
  });

  it("raising capacity never removes anyone from the calls", () => {
    fc.assert(
      fc.property(settingsArb, fc.integer({ min: 0, max: 20 }), (partial, extra) => {
        const base = { ...DEFAULT_ROUTING, ...partial };
        const before = new Set(
          routeLeads(leads, new Map(), base)
            .filter((d) => d.called)
            .map((d) => d.leadId),
        );
        const after = new Set(
          routeLeads(leads, new Map(), { ...base, capacity: base.capacity + extra })
            .filter((d) => d.called)
            .map((d) => d.leadId),
        );
        for (const id of before) expect(after.has(id)).toBe(true);
      }),
    );
  });

  it("raising the threshold never adds leads to the sales lane", () => {
    fc.assert(
      fc.property(settingsArb, fc.integer({ min: 0, max: 30 }), (partial, extra) => {
        const base = { ...DEFAULT_ROUTING, ...partial };
        const before = new Set(
          routeLeads(leads, new Map(), base)
            .filter((d) => d.lane === "sales")
            .map((d) => d.leadId),
        );
        const after = routeLeads(leads, new Map(), {
          ...base,
          threshold: base.threshold + extra,
        }).filter((d) => d.lane === "sales");
        for (const decision of after) expect(before.has(decision.leadId)).toBe(true);
      }),
    );
  });

  it("gives every lead exactly one decision", () => {
    const decisions = routeLeads(leads, new Map(), DEFAULT_ROUTING);
    expect(new Set(decisions.map((d) => d.leadId)).size).toBe(leads.length);
  });
});
