import { describe, expect, it } from "vitest";
import { AgentInput, checkSources, costOf, Limiter, type Research } from "./contract";

const research: Research = {
  company_summary: "A company.",
  signals: [
    { finding: "Hiring SDRs", source_url: "https://www.example.com/jobs/" },
    { finding: "Made up", source_url: "https://not-searched.example.org/post" },
  ],
  fit: { score: 70, reason: "Growing sales team." },
  first_message: { subject: "Hi", body: "Hello." },
  open_questions: [],
};

describe("research agent contract", () => {
  it("cleans and bounds what a visitor sends", () => {
    expect(
      AgentInput.parse({ company: "  Acme\u0000  Inc ", offer: "Lead routing for B2B teams" }),
    ).toEqual({ company: "Acme Inc", offer: "Lead routing for B2B teams" });
    expect(AgentInput.safeParse({ company: "A", offer: "Lead routing for B2B" }).success).toBe(
      false,
    );
    expect(AgentInput.safeParse({ company: "Acme", offer: "short" }).success).toBe(false);
    expect(AgentInput.safeParse({ company: "x".repeat(81), offer: "Lead routing" }).success).toBe(
      false,
    );
  });

  it("keeps only signals whose source was a search result", () => {
    const checked = checkSources(research, ["https://example.com/jobs"]);
    expect(checked.research.signals.map((signal) => signal.finding)).toEqual(["Hiring SDRs"]);
    expect(checked.removedSignals).toBe(1);
  });

  it("prices a run from its usage", () => {
    const cost = costOf({
      input_tokens: 10_000,
      output_tokens: 1_000,
      server_tool_use: { web_search_requests: 2 },
    });
    expect(cost).toBeCloseTo(0.04 + 0.02 + 0.02, 6);
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
