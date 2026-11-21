import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compareMotions, decide, plan } from "./decide";
import {
  ALL_OFF,
  ALL_ON,
  AUTOMATION_IDS,
  type Automations,
  MOTION_IDS,
  MOTIONS,
  TEAM,
} from "./model";
import { generateLeads, simulate, speedFactor } from "./simulate";

const anyAutomations = fc
  .tuple(...AUTOMATION_IDS.map(() => fc.boolean()))
  .map(
    (flags) =>
      Object.fromEntries(AUTOMATION_IDS.map((id, i) => [id, flags[i]])) as unknown as Automations,
  );

describe("GTM simulator", () => {
  it("is deterministic: the same setup gives the same result", () => {
    for (const motion of MOTION_IDS) {
      expect(simulate(motion, ALL_ON)).toEqual(simulate(motion, ALL_ON));
    }
  });

  it("generates each motion's leads once, in arrival order, inside the quarter", () => {
    for (const motion of MOTION_IDS) {
      const leads = generateLeads(MOTIONS[motion]);
      expect(leads).toHaveLength(MOTIONS[motion].leads);
      for (let i = 1; i < leads.length; i++) {
        expect(leads[i]?.arrivalDay).toBeGreaterThanOrEqual(leads[i - 1]?.arrivalDay ?? 0);
      }
      for (const lead of leads) {
        expect(lead.arrivalDay).toBeGreaterThanOrEqual(0);
        expect(lead.arrivalDay).toBeLessThan(TEAM.days);
        expect(lead.signalDay).toBeLessThan(TEAM.days);
        if (lead.duplicate) expect(lead.hasNeed).toBe(false);
      }
    }
  });

  it("a slower first touch never raises the chance of a meeting", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b, sensitivity) => {
          const [fast, slow] = a < b ? [a, b] : [b, a];
          expect(speedFactor(slow, sensitivity)).toBeLessThanOrEqual(
            speedFactor(fast, sensitivity),
          );
          expect(speedFactor(slow, sensitivity)).toBeGreaterThan(0);
        },
      ),
    );
  });

  it("keeps every count consistent for any combination of automations", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MOTION_IDS), anyAutomations, (motion, automations) => {
        const result = simulate(motion, automations);
        const leads = generateLeads(MOTIONS[motion]);
        const withNeed = leads.filter((lead) => lead.hasNeed).length;
        const signalNeeds = leads.filter((lead) => lead.signalDay >= 0 && lead.signalNeed).length;
        expect(result.meetings).toBeLessThanOrEqual(withNeed + signalNeeds);
        expect(result.opportunities).toBeLessThanOrEqual(result.meetings);
        expect(result.stages.worked).toBeLessThanOrEqual(result.stages.unique);
        expect(result.weeklyMeetings.reduce((a, b) => a + b, 0)).toBe(result.meetings);
        expect(result.pipeline).toBe(result.opportunities * MOTIONS[motion].dealSize);
        expect(result.repHours).toBeLessThanOrEqual(
          (TEAM.reps * TEAM.sellingHoursPerDay * TEAM.days * 5) / 7 +
            TEAM.reps * TEAM.sellingHoursPerDay,
        );
        if (automations.dedupe) expect(result.wastedHours).toBe(0);
        if (!automations.aiDrafts) expect(result.stages.aiDrafted).toBe(0);
        if (!automations.signals) expect(result.signalMeetings).toBe(0);
      }),
      { numRuns: 40 },
    );
  });

  it("the automated engine beats the manual one on meetings and cost for every motion", () => {
    for (const motion of MOTION_IDS) {
      const manual = simulate(motion, ALL_OFF);
      const automated = simulate(motion, ALL_ON);
      expect(automated.meetings).toBeGreaterThan(manual.meetings);
      expect(automated.costPerMeeting).toBeLessThan(manual.costPerMeeting);
      expect(automated.medianHoursToTouch).toBeLessThan(manual.medianHoursToTouch);
    }
  });
});

describe("decisions", () => {
  it("the recommended next move adds the meetings it promises", () => {
    for (const motion of MOTION_IDS) {
      const decision = decide(motion, ALL_OFF);
      const move = decision.next;
      if (!move) throw new Error(`no recommendation for ${motion}`);
      const after = simulate(motion, { ...ALL_OFF, [move.automation]: move.turnOn });
      expect(after.meetings - decision.current.meetings).toBe(move.deltaMeetings);
      expect(move.deltaMeetings).toBeGreaterThan(0);
      expect(decision.moves[0]?.deltaMeetings).toBe(move.deltaMeetings);
    }
  });

  it("only lists switching off what is on", () => {
    const decision = decide("inbound", { ...ALL_OFF, aiDrafts: true, scoring: true });
    expect(decision.contributions.map((move) => move.automation).sort()).toEqual([
      "aiDrafts",
      "scoring",
    ]);
  });

  it("compares every motion, cheapest meeting first", () => {
    const rows = compareMotions(ALL_ON);
    expect(rows.map((row) => row.motion).sort()).toEqual([...MOTION_IDS].sort());
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]?.result.costPerMeeting).toBeGreaterThanOrEqual(
        rows[i - 1]?.result.costPerMeeting ?? 0,
      );
    }
  });
});

describe("a visitor's own numbers", () => {
  it("defaults leave the model unchanged, and custom numbers are respected", () => {
    expect(simulate("inbound", ALL_ON, {})).toEqual(simulate("inbound", ALL_ON));
    const small = simulate("inbound", ALL_OFF, { leads: 300, reps: 1 });
    expect(small.stages.captured).toBe(300);
    const moreReps = simulate("inbound", ALL_OFF, { leads: 3000, reps: 8 });
    const fewReps = simulate("inbound", ALL_OFF, { leads: 3000, reps: 1 });
    expect(moreReps.meetings).toBeGreaterThan(fewReps.meetings);
  });

  it("a plan only takes steps that add meetings, and ends when none is left", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MOTION_IDS),
        fc.integer({ min: 50, max: 800 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 96 }),
        (motion, leadsPerMonth, reps, hours) => {
          const custom = { leads: leadsPerMonth * 3, reps, manualRoutingHours: hours };
          const result = plan(motion, ALL_OFF, custom);
          let previous = result.start.meetings;
          for (const step of result.steps) {
            expect(step.result.meetings).toBe(previous + step.move.deltaMeetings);
            expect(step.move.deltaMeetings).toBeGreaterThan(0);
            previous = step.result.meetings;
          }
        },
      ),
      { numRuns: 15 },
    );
  });
});
