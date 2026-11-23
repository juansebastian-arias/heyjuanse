import { describe, expect, it } from "vitest";
import { OWNER_IDS, SAMPLE_LEADS } from "../../content/agent/leads";
import {
  AgentInput,
  costOf,
  Limiter,
  SUBMIT_TOOL_SCHEMA,
  SYSTEM_PROMPT,
  Triage,
  userPrompt,
} from "./contract";

const triage: Triage = {
  intent: "demo_request",
  urgency: "this_week",
  fit: { score: 82, reason: "Mid-size logistics company on HubSpot." },
  route: { owner: "ana", reason: "Latin America, 220 employees." },
  reply: { subject: "Routing your inbound leads", body: "Hi Mariana, ..." },
  crm_note: "Asked for a demo. Next: book a call.",
  checks: [],
};

describe("inbound lead agent contract", () => {
  it("cleans and bounds what a visitor sends", () => {
    expect(AgentInput.parse({ message: "  We need a demo\u0000 for 40 reps  " })).toEqual({
      name: "",
      company: "",
      message: "We need a demo for 40 reps",
    });
    expect(AgentInput.safeParse({ message: "too short" }).success).toBe(false);
    expect(AgentInput.safeParse({ message: "x".repeat(601) }).success).toBe(false);
    expect(
      AgentInput.safeParse({ company: "x".repeat(81), message: "A long enough message" }).success,
    ).toBe(false);
  });

  it("accepts a valid result and rejects an unknown owner", () => {
    expect(Triage.safeParse(triage).success).toBe(true);
    expect(Triage.safeParse({ ...triage, route: { owner: "zoe", reason: "x" } }).success).toBe(
      false,
    );
  });

  it("offers the model exactly the owners the routing rules name", () => {
    expect(SUBMIT_TOOL_SCHEMA.properties.route.properties.owner.enum).toEqual(OWNER_IDS);
    for (const id of OWNER_IDS) expect(SYSTEM_PROMPT).toContain(`- ${id}:`);
  });

  it("fences the lead's message off as data", () => {
    const lead = SAMPLE_LEADS[0];
    if (!lead) throw new Error("no sample lead");
    const prompt = userPrompt(lead);
    expect(prompt).toContain(`<lead_message>\n${lead.message}\n</lead_message>`);
    expect(prompt).toContain(lead.record);
    expect(userPrompt({ message: "Hello there, pricing?" })).toContain("Nothing on record");
  });

  it("prices a run from its usage", () => {
    expect(costOf({ input_tokens: 10_000, output_tokens: 1_000 })).toBeCloseTo(0.06, 6);
  });

  it("limits hits per key inside the window", () => {
    const limiter = new Limiter(2, 1000);
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("a", 10)).toBe(true);
    expect(limiter.take("a", 20)).toBe(false);
    expect(limiter.take("b", 20)).toBe(true);
    expect(limiter.take("a", 1500)).toBe(true);
  });
});
